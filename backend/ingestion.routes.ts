// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from './database';
import { LogEntry } from './types';
import * as crypto from 'crypto';
import { emitLog } from './websocket';

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

    console.log(`[Ingest] Auth attempt. Prefix: ${keyPrefix}`);

    try {
        const potentialKeys = await db.all<{ keyHash: string, organizationId: string }>(
            'SELECT "keyHash", "organizationId" FROM api_keys WHERE "keyPrefix" = ?',
            [keyPrefix]
        );

        console.log(`[Ingest] Found ${potentialKeys.length} matching prefixes`);

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
        await db.run(
            'INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore") VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, processedLog.organizationId, timestamp, processedLog.level, processedLog.message, processedLog.source, processedLog.anomalyScore]
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
            anomalyScore: processedLog.anomalyScore
        }).catch((e: any) => console.error('Alerting check failed:', e));

        // Emit log to WebSocket for real-time streaming (Live Tail)
        emitLog({
            id,
            organizationId: processedLog.organizationId,
            timestamp,
            level: processedLog.level,
            message: processedLog.message,
            source: processedLog.source,
            anomalyScore: processedLog.anomalyScore
        });

        res.status(202).json({ message: 'Log received.' });
    } catch (error) {
        console.error('Failed to ingest log:', error);
        res.status(500).json({ message: 'Failed to ingest log.' });
    }
});

export default router;