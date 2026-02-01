import express from 'express';
import { protect } from './auth.routes';
import { getDb } from './database';
import { Role, User } from './types';
import fetch from 'node-fetch';

const router = express.Router();

router.use(protect);

const getPythonServiceUrl = () => {
    let url = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    if (!url.startsWith('http')) {
        url = `http://${url}`;
    }
    return url.replace(/\/$/, '');
};

const canAccessOrg = (user: User, organizationId: string) => {
    return user.role === Role.SUPER_ADMIN || user.organizationId === organizationId;
};

const parsePayload = (payload: any) => {
    if (typeof payload === 'string') {
        try { return JSON.parse(payload); } catch { return {}; }
    }
    return payload ?? {};
};

// GET /api/alerts/events
router.get('/events', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const type = (req.query.type as string | undefined) || undefined;
    const severity = (req.query.severity as string | undefined) || undefined;
    const sent = (req.query.sent as string | undefined) || undefined;

    const db = getDb();
    try {
        const whereClauses: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        if (user.role !== Role.SUPER_ADMIN) {
            whereClauses.push(`"organizationId" = $${paramIdx++}`);
            params.push(user.organizationId);
        }
        if (type) {
            whereClauses.push(`"type" = $${paramIdx++}`);
            params.push(type);
        }
        if (severity) {
            whereClauses.push(`"severity" = $${paramIdx++}`);
            params.push(severity);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const rows = await db.all<any>(
            `SELECT "id", "organizationId", "type", "severity", "source", "logId", "payload", "createdAt" FROM alert_events ${whereSql} ORDER BY "createdAt" DESC LIMIT $${paramIdx}`,
            [...params, limit]
        );

        const events = rows
            .map((r: any) => {
                const payload = parsePayload(r.payload);
                const suppressed = !!payload?.suppressed;
                const log = payload?.log;
                return {
                    id: r.id,
                    organizationId: r.organizationId,
                    type: r.type,
                    severity: r.severity,
                    source: r.source,
                    logId: r.logId,
                    createdAt: r.createdAt,
                    sent: !suppressed,
                    suppressed,
                    log,
                    proposal: payload?.proposal ?? null,
                };
            })
            .filter((e: any) => {
                if (!sent) return true;
                if (sent === 'true') return e.sent === true;
                if (sent === 'false') return e.sent === false;
                return true;
            });

        return res.status(200).json(events);
    } catch (e: any) {
        return res.status(500).json({ message: e.message || 'Failed to load alerts.' });
    }
});

// GET /api/alerts/events/:id
router.get('/events/:id', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();
    try {
        const row = await db.get<any>(
            'SELECT "id", "organizationId", "type", "severity", "source", "logId", "payload", "createdAt" FROM alert_events WHERE "id" = ?',
            [req.params.id]
        );
        if (!row) return res.status(404).json({ message: 'Alert not found' });
        if (!canAccessOrg(user, row.organizationId)) return res.status(403).json({ message: 'Forbidden' });

        const payload = parsePayload(row.payload);
        const suppressed = !!payload?.suppressed;
        return res.status(200).json({
            id: row.id,
            organizationId: row.organizationId,
            type: row.type,
            severity: row.severity,
            source: row.source,
            logId: row.logId,
            createdAt: row.createdAt,
            sent: !suppressed,
            suppressed,
            log: payload?.log ?? null,
            threshold: payload?.threshold ?? null,
            score: payload?.score ?? null,
            proposal: payload?.proposal ?? null,
        });
    } catch (e: any) {
        return res.status(500).json({ message: e.message || 'Failed to load alert.' });
    }
});

// POST /api/alerts/events/:id/proposal
router.post('/events/:id/proposal', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();
    try {
        const row = await db.get<any>(
            'SELECT "id", "organizationId", "payload" FROM alert_events WHERE "id" = ?',
            [req.params.id]
        );
        if (!row) return res.status(404).json({ message: 'Alert not found' });
        if (!canAccessOrg(user, row.organizationId)) return res.status(403).json({ message: 'Forbidden' });

        const payload = parsePayload(row.payload);
        const log = payload?.log;
        if (!log) return res.status(400).json({ message: 'Alert has no log payload' });

        const pythonServiceUrl = getPythonServiceUrl();
        const [rcaResp, playbookResp] = await Promise.all([
            fetch(`${pythonServiceUrl}/rca`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetLog: log, logHistory: [] })
            }),
            fetch(`${pythonServiceUrl}/playbook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetLog: log })
            })
        ]);

        if (!rcaResp.ok || !playbookResp.ok) {
            return res.status(503).json({ message: 'Python service unavailable' });
        }

        const rca = await rcaResp.json();
        const playbook = await playbookResp.json();

        const proposal = {
            createdAt: new Date().toISOString(),
            rca,
            playbook,
        };

        const newPayload = { ...payload, proposal };
        await db.run(
            'UPDATE alert_events SET "payload" = ? WHERE "id" = ?',
            [JSON.stringify(newPayload), row.id]
        );

        return res.status(200).json({ proposal });
    } catch (e: any) {
        return res.status(500).json({ message: e.message || 'Failed to generate proposal.' });
    }
});

// GET /api/alerts/history
router.get('/history', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    const db = getDb();
    try {
        const where = user.role === Role.SUPER_ADMIN ? '' : 'WHERE "organizationId" = $1';
        const params: any[] = user.role === Role.SUPER_ADMIN ? [] : [user.organizationId];

        const rows = await db.all<any>(
            `SELECT "id", "organizationId", "payload", "createdAt" FROM alert_events ${where} ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`,
            [...params, limit]
        );

        const history = rows
            .map((r: any) => {
                const payload = parsePayload(r.payload);
                const log = payload?.log;
                if (!log) return null;

                return {
                    id: r.id,
                    timestamp: r.createdAt,
                    log,
                };
            })
            .filter(Boolean);

        res.status(200).json(history);
    } catch (e: any) {
        res.status(500).json({ message: e.message || 'Failed to load alert history.' });
    }
});

export default router;
