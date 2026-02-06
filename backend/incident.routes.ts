// backend/incident.routes.ts
import express from 'express';
import { protect } from './auth.routes';
import { getDb } from './database';
import { Incident, IncidentStatus, User } from './types';
import * as crypto from 'crypto';

const router = express.Router();

// All incident routes are protected
router.use(protect);

// Helper to parse JSONB fields that might come as strings from pg
const parseJsonField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return field; }
    }
    return field;
};

// Helper: Seed initial incidents from FATAL logs if the incidents table is empty
const ensureIncidentsSeeded = async (organizationId: string) => {
    const db = getDb();
    const existing = await db.get<{ count: string }>('SELECT COUNT(*) as count FROM incidents WHERE "organizationId" = ?', [organizationId]);
    if (existing && parseInt(existing.count, 10) > 0) return;

    console.log(`[Incidents] No incidents found for org ${organizationId}, seeding from FATAL logs...`);
    const fatalLogs = await db.all<any>(
        `SELECT * FROM logs WHERE "organizationId" = ? AND "level" = 'FATAL' ORDER BY "timestamp" DESC LIMIT 3`,
        [organizationId]
    );

    if (fatalLogs.length === 0) {
        console.log("[Incidents] No fatal logs found to seed incidents.");
        return;
    }

    const statusValues = Object.values(IncidentStatus);

    for (let index = 0; index < fatalLogs.length; index++) {
        const log = fatalLogs[index];
        const incidentId = crypto.randomUUID();
        const status = statusValues[index % statusValues.length];

        const rcaResult = {
            summary: `The fatal error in ${log.source} appears to be caused by a database connection timeout, which was preceded by a spike in CPU usage warnings. This suggests the database was under heavy load, became unresponsive, and caused the dependent service to fail.`,
            keyEvents: [],
            nextSteps: [
                "Check the database server's CPU and memory utilization during the incident period.",
                "Inspect database logs for long-running queries or errors.",
                "Consider increasing the connection pool size or optimizing slow queries."
            ]
        };

        const playbook = {
            title: "Database Connection Failure Remediation",
            summary: "This playbook outlines steps to diagnose and resolve a database connection failure.",
            severity: 4,
            triageSteps: [
                { step: 1, action: "Check the status of the PostgreSQL container.", command: "docker ps | grep postgres-db" },
                { step: 2, action: "Tail the logs of the service to look for specific connection error messages.", command: `docker logs -f ${log.source.replace('-service', '')}` },
                { step: 3, action: "Attempt to connect to the database directly from the backend container.", command: "docker exec -it ai-log-analyzer-backend psql -h db -U admin -d ailoganalyzer" }
            ],
            escalationPath: "If the database is down and cannot be restarted, escalate to the on-call SRE."
        };

        await db.run(
            `INSERT INTO incidents ("id", "organizationId", "title", "status", "severity", "createdAt", "triggeringLog", "rcaResult", "playbook")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                incidentId,
                organizationId,
                `Unresponsive Database Detected in ${log.source}`,
                status,
                5,
                log.timestamp,
                JSON.stringify(log),
                JSON.stringify(rcaResult),
                JSON.stringify(playbook)
            ]
        );

        // Add initial activity note
        await db.run(
            `INSERT INTO incident_activity ("id", "incidentId", "timestamp", "userId", "username", "note")
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                crypto.randomUUID(),
                incidentId,
                new Date(new Date(log.timestamp).getTime() + 1 * 60000).toISOString(),
                'system',
                'AetherLog AI',
                'Incident automatically created based on FATAL log entry.'
            ]
        );
    }
    console.log(`[Incidents] Seeded ${fatalLogs.length} incidents.`);
};

// GET /api/incidents
router.get('/', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();

    try {
        await ensureIncidentsSeeded(user.organizationId);

        const incidents = await db.all<any>(
            'SELECT * FROM incidents WHERE "organizationId" = ? ORDER BY "createdAt" DESC',
            [user.organizationId]
        );

        // Attach activity logs to each incident
        const result = await Promise.all(incidents.map(async (inc: any) => {
            const activityLog = await db.all<any>(
                'SELECT * FROM incident_activity WHERE "incidentId" = ? ORDER BY "timestamp" ASC',
                [inc.id]
            );
            return {
                ...inc,
                triggeringLog: parseJsonField(inc.triggeringLog),
                rcaResult: parseJsonField(inc.rcaResult),
                playbook: parseJsonField(inc.playbook),
                activityLog
            };
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('[Incidents] Failed to fetch:', error);
        res.status(500).json({ message: 'Failed to fetch incidents.' });
    }
});

// GET /api/incidents/:id
router.get('/:id', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();

    try {
        await ensureIncidentsSeeded(user.organizationId);

        const incident = await db.get<any>(
            'SELECT * FROM incidents WHERE "id" = ? AND "organizationId" = ?',
            [req.params.id, user.organizationId]
        );

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        const activityLog = await db.all<any>(
            'SELECT * FROM incident_activity WHERE "incidentId" = ? ORDER BY "timestamp" ASC',
            [incident.id]
        );

        res.status(200).json({
            ...incident,
            triggeringLog: parseJsonField(incident.triggeringLog),
            rcaResult: parseJsonField(incident.rcaResult),
            playbook: parseJsonField(incident.playbook),
            activityLog
        });
    } catch (error) {
        console.error('[Incidents] Failed to fetch by id:', error);
        res.status(500).json({ message: 'Failed to fetch incident.' });
    }
});

// PATCH /api/incidents/:id
router.patch('/:id', async (req: express.Request, res: express.Response) => {
    const { status } = req.body;
    const user = (req as any).user as User;

    if (!status || !Object.values(IncidentStatus).includes(status)) {
        return res.status(400).json({ message: 'A valid status is required.' });
    }

    const db = getDb();
    try {
        const resolvedAt = status === IncidentStatus.RESOLVED ? new Date().toISOString() : null;

        const result = await db.run(
            `UPDATE incidents SET "status" = ?, "resolvedAt" = COALESCE(?, "resolvedAt") WHERE "id" = ? AND "organizationId" = ?`,
            [status, resolvedAt, req.params.id, user.organizationId]
        );

        if (!result.changes || result.changes === 0) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        // Add status change to activity log
        await db.run(
            `INSERT INTO incident_activity ("id", "incidentId", "timestamp", "userId", "username", "note")
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                crypto.randomUUID(),
                req.params.id,
                new Date().toISOString(),
                user.id,
                user.username,
                `Status changed to ${status}`
            ]
        );

        // Fetch and return updated incident
        const incident = await db.get<any>('SELECT * FROM incidents WHERE "id" = ?', [req.params.id]);
        const activityLog = await db.all<any>('SELECT * FROM incident_activity WHERE "incidentId" = ? ORDER BY "timestamp" ASC', [req.params.id]);

        res.status(200).json({
            ...incident,
            triggeringLog: parseJsonField(incident?.triggeringLog),
            rcaResult: parseJsonField(incident?.rcaResult),
            playbook: parseJsonField(incident?.playbook),
            activityLog
        });
    } catch (error) {
        console.error('[Incidents] Failed to update:', error);
        res.status(500).json({ message: 'Failed to update incident.' });
    }
});

// POST /api/incidents/:id/notes
router.post('/:id/notes', async (req: express.Request, res: express.Response) => {
    const { note, userId, username } = req.body;
    if (!note || !userId || !username) {
        return res.status(400).json({ message: 'Note, userId, and username are required.' });
    }

    const user = (req as any).user as User;
    const db = getDb();

    try {
        // Verify incident belongs to user's org
        const incident = await db.get<any>(
            'SELECT "id" FROM incidents WHERE "id" = ? AND "organizationId" = ?',
            [req.params.id, user.organizationId]
        );

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        await db.run(
            `INSERT INTO incident_activity ("id", "incidentId", "timestamp", "userId", "username", "note")
             VALUES (?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), req.params.id, new Date().toISOString(), userId, username, note]
        );

        // Fetch and return updated incident
        const updated = await db.get<any>('SELECT * FROM incidents WHERE "id" = ?', [req.params.id]);
        const activityLog = await db.all<any>('SELECT * FROM incident_activity WHERE "incidentId" = ? ORDER BY "timestamp" ASC', [req.params.id]);

        res.status(200).json({
            ...updated,
            triggeringLog: parseJsonField(updated?.triggeringLog),
            rcaResult: parseJsonField(updated?.rcaResult),
            playbook: parseJsonField(updated?.playbook),
            activityLog
        });
    } catch (error) {
        console.error('[Incidents] Failed to add note:', error);
        res.status(500).json({ message: 'Failed to add note.' });
    }
});

export default router;