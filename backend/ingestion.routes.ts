// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from './database';
import { LogEntry } from './types';
import * as crypto from 'crypto';
import { emitLog } from './websocket';
import fetch from 'node-fetch';

const router = express.Router();

// Middleware to authenticate via API key
const authenticateApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providedKey = req.header('X-API-KEY');
    if (!providedKey) {
        console.warn('[Ingest] Failed: API key missing');
        return res.status(401).json({ message: 'API key is required.' });
    }

    const keyPrefix = providedKey.substring(0, 8);
    const db = getDb();

    try {
        const potentialKeys = await db.all<{ keyHash: string, organizationId: string }>(
            'SELECT "keyHash", "organizationId" FROM api_keys WHERE "keyPrefix" = ?',
            [keyPrefix]
        );

        if (potentialKeys.length === 0) {
            return res.status(401).json({ message: 'Invalid API key (prefix mismatch).' });
        }

        for (const key of potentialKeys) {
            const isValid = await bcrypt.compare(providedKey, key.keyHash);
            if (isValid) {
                console.log(`[Ingest] Auth successful for org: ${key.organizationId}`);
                (req as any).organizationId = key.organizationId;
                // Async update
                db.run('UPDATE api_keys SET "lastUsed" = NOW() WHERE "keyHash" = ?', [key.keyHash]).catch(console.error);
                return next();
            }
        }

        console.warn('[Ingest] Failed: Hash mismatch for existing prefix');
        return res.status(401).json({ message: 'Invalid API key.' });

    } catch (error) {
        console.error('API key authentication error:', error);
        return res.status(500).json({ message: 'Server error during authentication.' });
    }
};

// POST /api/ingest
// Public-facing endpoint for external services to send logs
router.post('/', authenticateApiKey, async (req: express.Request, res: express.Response) => {
    console.log('[Ingest] Received ingestion request');
    const organizationId = (req as any).organizationId;
    const logData = req.body;

    // Basic validation
    if (!logData.level || !logData.message || !logData.source) {
        return res.status(400).json({ message: 'Log entry must include level, message, and source.' });
    }
    
    // Anomaly score is optional and can be calculated by another service later
    const newLog: Omit<LogEntry, 'id' | 'timestamp'> = {
        organizationId,
        level: logData.level,
        message: logData.message,
        source: logData.source,
        // A client-supplied score is kept as is; otherwise the AI service scores the log below.
        // Never a made-up value: if nothing scores it, it stays null ("not scored").
        anomalyScore: typeof logData.anomalyScore === 'number' ? logData.anomalyScore : null,
    };

    const db = getDb();
    const { processLogThroughPipelines } = require('./pipelineService');

    try {
        // The anomaly model must score the SAME text it was trained on, so keep a copy of the ORIGINAL log for
        // scoring. Privacy masking still applies to everything that is stored or shown (processedLog below);
        // the unmasked copy is only sent to the local AI service and is never saved.
        const scoringLog = { level: newLog.level, message: newLog.message, source: newLog.source };

        // Process log through organizational pipelines (PII masking, filtering, etc.)
        const processedLog = await processLogThroughPipelines(newLog, organizationId);
        
        // If the pipeline filtered out the log, return success but don't save
        if (!processedLog) {
            return res.status(202).json({ message: 'Log processed (filtered).' });
        }

        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        // Real-time AI scoring via the Python service.
        // ANOMALY_MODEL=cascade -> BGL cascade (/cascade); otherwise the keyword rule (/urgency). Default: keyword rule.
        // If the AI service is unreachable or errors, the log is stored UNSCORED (null) - never a made-up value.
        const useCascade = process.env.ANOMALY_MODEL === 'cascade';
        const endpoint = useCascade ? '/cascade' : '/urgency';
        let enrichedAnomalyScore: number | null = processedLog.anomalyScore ?? null;
        let enrichedThreatCategory: string = enrichedAnomalyScore === null ? 'Not scored' : 'Client-scored';
        let scoreStage: string | null = enrichedAnomalyScore === null ? null : 'client';
        let scoreModel: string | null = null, scoreThreshold: number | null = null;
        let scoreModelHash: string | null = null, scoreCodeHash: string | null = null;

        if (enrichedAnomalyScore === null) {
            try {
                const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001';
                const aiController = new AbortController();
                const aiTimeout = setTimeout(() => aiController.abort(), useCascade ? 10000 : 2000);
                const aiResponse = await fetch(`${pythonServiceUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ log: scoringLog }),   // unmasked original (scoring only, not stored)
                    signal: aiController.signal as any
                });
                clearTimeout(aiTimeout);

                if (aiResponse.ok) {
                    const ai = await aiResponse.json() as { urgency: string, score: number, stage?: string, model?: string,
                        threshold?: number | null, model_hash?: string | null, code_hash?: string | null };
                    if (typeof ai.score === 'number') {
                        enrichedAnomalyScore = ai.score;
                        enrichedThreatCategory = ai.urgency;
                        scoreStage = ai.stage ?? null;
                        scoreModel = ai.model ?? null;
                        scoreThreshold = ai.threshold ?? null;
                        scoreModelHash = ai.model_hash ?? null;
                        scoreCodeHash = ai.code_hash ?? null;
                    }
                } else {
                    console.error(`[Ingest] AI service ${endpoint} returned ${aiResponse.status}; log stored as not scored.`);
                }
            } catch (aiError: any) {
                console.error(`[Ingest] AI service ${endpoint} unreachable (${aiError.message}); log stored as not scored.`);
            }
        }

        await db.run(
            'INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore", "threatCategory", "scoreStage", "scoreModel", "scoreThreshold", "scoreModelHash", "scoreCodeHash") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, processedLog.organizationId, timestamp, processedLog.level, processedLog.message, processedLog.source, enrichedAnomalyScore, enrichedThreatCategory,
             scoreStage, scoreModel, scoreThreshold, scoreModelHash, scoreCodeHash]
        );
        
        // Trigger alerting check
        const { checkAndAlert } = require('./alertingService');
        checkAndAlert({
            id,
            organizationId: processedLog.organizationId,
            timestamp,
            level: processedLog.level,
            message: processedLog.message,
            source: processedLog.source,
            anomalyScore: enrichedAnomalyScore,
            threatCategory: enrichedThreatCategory
        }).catch((e: any) => console.error('Alerting check failed:', e));

        // Emit log to WebSocket for real-time streaming (Live Tail)
        emitLog({
            id,
            organizationId: processedLog.organizationId,
            timestamp,
            level: processedLog.level,
            message: processedLog.message,
            source: processedLog.source,
            anomalyScore: enrichedAnomalyScore,
            threatCategory: enrichedThreatCategory
        });

        res.status(202).json({ message: 'Log received.' });
    } catch (error) {
        console.error('Failed to ingest log:', error);
        res.status(500).json({ message: 'Failed to ingest log.' });
    }
});

export default router;