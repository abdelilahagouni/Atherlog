// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from './database';
import { LogEntry } from './types';
import * as crypto from 'crypto';

const router = express.Router();

// Middleware to authenticate via API key
const authenticateApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providedKey = req.header('X-API-KEY');
    if (!providedKey) {
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
            return res.status(401).json({ message: 'Invalid API key.' });
        }

        for (const key of potentialKeys) {
            const isValid = await bcrypt.compare(providedKey, key.keyHash);
            if (isValid) {
                (req as any).organizationId = key.organizationId;
                // Asynchronously update lastUsed without blocking the request
                db.run('UPDATE api_keys SET "lastUsed" = NOW() WHERE "keyHash" = ?', [key.keyHash]).catch(console.error);
                return next();
            }
        }

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
    try {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        await db.run(
            'INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore") VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, newLog.organizationId, timestamp, newLog.level, newLog.message, newLog.source, newLog.anomalyScore]
        );
        
        // Trigger alerting check
        const { checkAndAlert } = require('./alertingService');
        checkAndAlert({
            id,
            organizationId: newLog.organizationId,
            timestamp,
            level: newLog.level,
            message: newLog.message,
            source: newLog.source,
            anomalyScore: newLog.anomalyScore
        }).catch((e: any) => console.error('Alerting check failed:', e));

        res.status(202).json({ message: 'Log received.' });
    } catch (error) {
        console.error('Failed to ingest log:', error);
        res.status(500).json({ message: 'Failed to ingest log.' });
    }
});

export default router;