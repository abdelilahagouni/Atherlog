
import express from 'express';
import { getDb } from './database';
import { User, LogEntry, LogFilter } from './types';
import { protect } from './auth.routes';
import * as crypto from 'crypto';

const router = express.Router();

router.use(protect);
 
// GET /api/logs - Fetch recent logs for live view
router.get('/', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const limit = parseInt(req.query.limit as string) || 50;
    const db = getDb();
    try {
        const logs = await db.all<LogEntry>(
            'SELECT * FROM logs WHERE "organizationId" = ? ORDER BY "timestamp" DESC LIMIT ?',
            [user.organizationId, limit]
        );
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch logs." });
    }
});

// GET /api/logs/history - Fetch historical logs for analysis
router.get('/history', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const limit = parseInt(req.query.limit as string) || 200;
    const db = getDb();
    try {
        const logs = await db.all<LogEntry>(
            'SELECT * FROM logs WHERE "organizationId" = ? ORDER BY "timestamp" DESC LIMIT ?',
            [user.organizationId, limit]
        );
        res.status(200).json(logs);
    } catch (error) {
        console.error("Failed to fetch history:", error);
        res.status(500).json({ message: "Failed to fetch log history." });
    }
});

// POST /api/logs/bulk - Optimized multi-row insert for datasets
router.post('/bulk', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const { logs } = req.body as { logs: Partial<LogEntry>[] };

    if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({ message: 'Logs array is required.' });
    }

    const db = getDb();
    try {
        let values: any[] = [];
        let placeholders: string[] = [];
        let paramIdx = 1;

        const insertedLogs: LogEntry[] = [];

        // Process logs in chunks if necessary, but here we expect the client to chunk
        logs.forEach(log => {
            const id = crypto.randomUUID();
            const timestamp = log.timestamp || new Date().toISOString();
            const level = log.level || 'INFO';
            const message = log.message || '';
            const source = log.source || 'dataset-import';
            const score = log.anomalyScore || 0;

            insertedLogs.push({
                id,
                organizationId: user.organizationId,
                timestamp,
                level: level as any,
                message,
                source,
                anomalyScore: score,
            });

            placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
            values.push(id, user.organizationId, timestamp, level, message, source, score);
        });

        if (placeholders.length > 0) {
            const sql = `INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore") VALUES ${placeholders.join(', ')}`;
            await db.run(sql, values);
        }

        const candidates = insertedLogs.filter(l => l.level === 'FATAL' || (l.anomalyScore ?? 0) >= 0.7);
        if (candidates.length > 0) {
            const { checkAndAlert } = require('./alertingService');
            Promise.allSettled(candidates.slice(0, 50).map(l => checkAndAlert(l))).catch(() => undefined);
        }

        res.status(201).json({ count: placeholders.length, message: `Successfully ingested ${placeholders.length} logs.` });

    } catch (error) {
        console.error("Failed bulk ingestion:", error);
        res.status(500).json({ message: "Failed to process bulk ingestion." });
    }
});

// GET /api/logs/explore
router.get('/explore', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const { 
        query: searchQuery, 
        startDate, 
        endDate, 
        levels, 
        sources, 
        page = '1', 
        limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const db = getDb();
    try {
        let whereClauses: string[] = ['"organizationId" = $1'];
        let params: any[] = [user.organizationId];
        let paramIndex = 2;

        if (startDate) {
            whereClauses.push(`"timestamp" >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`"timestamp" <= $${paramIndex++}`);
            params.push(endDate);
        }
        if (levels) {
            whereClauses.push(`"level" = ANY($${paramIndex++}::text[])`);
            params.push((levels as string).split(','));
        }
        if (sources) {
            whereClauses.push(`"source" = ANY($${paramIndex++}::text[])`);
            params.push((sources as string).split(','));
        }
        if (searchQuery) {
            whereClauses.push(`"message_tsv" @@ plainto_tsquery('english', $${paramIndex++})`);
            params.push(searchQuery as string);
        }

        const whereString = whereClauses.join(' AND ');
        const countResult = await db.get<{ count: string }>(`SELECT COUNT(*) FROM logs WHERE ${whereString}`, params);
        const totalLogs = parseInt(countResult?.count || '0', 10);

        const logQuery = `SELECT * FROM logs WHERE ${whereString} ORDER BY "timestamp" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        const logs = await db.all<LogEntry>(logQuery, [...params, limitNum, offset]);

        res.status(200).json({
            logs,
            pagination: {
                total: totalLogs,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalLogs / limitNum),
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to explore logs." });
    }
});

// GET /api/logs/histogram
router.get('/histogram', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const { startDate, endDate, levels, sources } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required." });
    }

    const db = getDb();
    try {
        let whereClauses: string[] = ['"organizationId" = $1', '"timestamp" >= $2', '"timestamp" <= $3'];
        let params: any[] = [user.organizationId, startDate, endDate];
        let paramIndex = 4;

        if (levels) {
            whereClauses.push(`"level" = ANY($${paramIndex++}::text[])`);
            params.push((levels as string).split(','));
        }
        if (sources) {
            whereClauses.push(`"source" = ANY($${paramIndex++}::text[])`);
            params.push((sources as string).split(','));
        }

        const whereString = whereClauses.join(' AND ');
        const histogramQuery = `
            SELECT
                DATE_TRUNC('hour', "timestamp") AS bucket,
                COUNT(*) AS count
            FROM logs
            WHERE ${whereString}
            GROUP BY bucket
            ORDER BY bucket;
        `;
        
        const histogram = await db.all<{ bucket: string, count: string }>(histogramQuery, params);
        res.status(200).json(histogram.map(h => ({ time: h.bucket, count: parseInt(h.count, 10) })));
    } catch (error) {
        res.status(500).json({ message: "Failed to get log histogram." });
    }
});

router.get('/anomalies', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const threshold = parseFloat(req.query.threshold as string) || 0.5;
    const db = getDb();
    try {
        const anomalies = await db.all<LogEntry>(
            'SELECT * FROM logs WHERE "organizationId" = ? AND "anomalyScore" > ? ORDER BY "timestamp" DESC LIMIT 500',
            [user.organizationId, threshold]
        );
        res.status(200).json(anomalies);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch anomalies." });
    }
});

router.get('/summary', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();
    try {
        const query = `
            SELECT
                TO_CHAR(DATE_TRUNC('hour', "timestamp"), 'HH24:00') AS hour,
                COUNT(*)::int AS total,
                COUNT(CASE WHEN "anomalyScore" > 0.5 THEN 1 END)::int AS anomalies,
                COUNT(CASE WHEN "level" = 'ERROR' THEN 1 END)::int AS errors,
                COUNT(CASE WHEN "level" = 'FATAL' THEN 1 END)::int AS fatals
            FROM logs
            WHERE "organizationId" = $1 AND "timestamp" >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour;
        `;
        const result = await db.all<any>(query, [user.organizationId]);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch summary." });
    }
});

export default router;
