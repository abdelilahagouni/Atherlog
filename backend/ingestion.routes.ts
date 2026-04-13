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
        anomalyScore: logData.anomalyScore || Math.random() * 0.3, // Assign a low default score
    };

    const db = getDb();
    const { processLogThroughPipelines } = require('./pipelineService');

    try {
        // Process log through organizational pipelines (PII masking, filtering, etc.)
        const processedLog = await processLogThroughPipelines(newLog, organizationId);
        
        // If the pipeline filtered out the log, return success but don't save
        if (!processedLog) {
            return res.status(202).json({ message: 'Log processed (filtered).' });
        }

        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        // Real-time AI Enrichment via Python Service
        let enrichedAnomalyScore = processedLog.anomalyScore || 0.1;
        let enrichedThreatCategory = 'Informational';

        try {
            const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
            console.log(`[Ingest] Calling Python AI at ${pythonServiceUrl}/urgency...`);
            // Use a 2-second timeout to prevent slow AI service from blocking ingestion
            const aiController = new AbortController();
            const aiTimeout = setTimeout(() => aiController.abort(), 2000);
            const aiResponse = await fetch(`${pythonServiceUrl}/urgency`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ log: processedLog }),
                signal: aiController.signal as any
            });
            clearTimeout(aiTimeout);

            if (aiResponse.ok) {
                const aiData = await aiResponse.json() as { urgency: string, score: number };
                enrichedThreatCategory = aiData.urgency;
                enrichedAnomalyScore = aiData.score;
                console.log(`[Ingest] AI Enriched: ${enrichedThreatCategory} (Score: ${enrichedAnomalyScore})`);
            } else {
                console.error(`[Ingest] AI Service returned ${aiResponse.status}: ${aiResponse.statusText}`);
            }
        } catch (aiError: any) {
            console.error('[Ingest] AI Enrichment connection failed:', aiError.message);
        }

        await db.run(
            'INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore", "threatCategory") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, processedLog.organizationId, timestamp, processedLog.level, processedLog.message, processedLog.source, enrichedAnomalyScore, enrichedThreatCategory]
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