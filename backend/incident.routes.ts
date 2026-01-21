// backend/incident.routes.ts
import express from 'express';
import { protect } from './auth.routes';
import { getDb } from './database';
import { Incident, IncidentStatus, User } from './types';
import * as crypto from 'crypto';

const router = express.Router();

// All incident routes are protected
router.use(protect);

let mockIncidents: Incident[] = [];

// Helper to generate mock incidents if they don't exist
const ensureMockIncidents = async () => {
    if (mockIncidents.length > 0) return;

    console.log("Generating mock incidents for demonstration...");
    const db = getDb();
    const fatalLogs = await db.all<any>(`SELECT * FROM logs WHERE "level" = 'FATAL' ORDER BY "timestamp" DESC LIMIT 3`);

    if (fatalLogs.length === 0) {
        console.log("No fatal logs found to create mock incidents.");
        return;
    }

    mockIncidents = fatalLogs.map((log, index) => {
        const statusValues = Object.values(IncidentStatus);
        const status = statusValues[index % statusValues.length];
        return {
            id: crypto.randomUUID(),
            title: `Unresponsive Database Detected in ${log.source}`,
            status: status,
            severity: 5,
            createdAt: log.timestamp,
            triggeringLog: log,
            rcaResult: {
                summary: `The fatal error in ${log.source} appears to be caused by a database connection timeout, which was preceded by a spike in CPU usage warnings. This suggests the database was under heavy load, became unresponsive, and caused the dependent service to fail.`,
                keyEvents: [],
                nextSteps: [
                    "Check the database server's CPU and memory utilization during the incident period.",
                    "Inspect database logs for long-running queries or errors.",
                    "Consider increasing the connection pool size or optimizing slow queries."
                ]
            },
            playbook: {
                title: "Database Connection Failure Remediation",
                summary: "This playbook outlines steps to diagnose and resolve a database connection failure.",
                severity: 4,
                triageSteps: [
                    { step: 1, action: "Check the status of the PostgreSQL container.", command: "docker ps | grep postgres-db" },
                    { step: 2, action: "Tail the logs of the service to look for specific connection error messages.", command: `docker logs -f ${log.source.replace('-service', '')}` },
                    { step: 3, action: "Attempt to connect to the database directly from the backend container to rule out network issues.", command: "docker exec -it ai-log-analyzer-backend psql -h db -U admin -d ailoganalyzer" }
                ],
                escalationPath: "If the database is down and cannot be restarted, escalate to the on-call SRE."
            },
            activityLog: [
                {
                    id: crypto.randomUUID(),
                    timestamp: new Date(new Date(log.timestamp).getTime() + 1 * 60000).toISOString(),
                    userId: 'system',
                    username: 'AetherLog AI',
                    note: 'Incident automatically created based on FATAL log entry.'
                }
            ]
        };
    });
};

// GET /api/incidents
router.get('/', async (req: express.Request, res: express.Response) => {
    await ensureMockIncidents();
    res.status(200).json(mockIncidents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

// GET /api/incidents/:id
router.get('/:id', async (req: express.Request, res: express.Response) => {
    await ensureMockIncidents();
    const incident = mockIncidents.find(inc => inc.id === req.params.id);
    if (incident) {
        res.status(200).json(incident);
    } else {
        res.status(404).json({ message: 'Incident not found' });
    }
});

// PATCH /api/incidents/:id
router.patch('/:id', async (req: express.Request, res: express.Response) => {
    const { status } = req.body;
    if (!status || !Object.values(IncidentStatus).includes(status)) {
        return res.status(400).json({ message: 'A valid status is required.' });
    }

    await ensureMockIncidents();
    const incidentIndex = mockIncidents.findIndex(inc => inc.id === req.params.id);
    if (incidentIndex > -1) {
        mockIncidents[incidentIndex].status = status;
        res.status(200).json(mockIncidents[incidentIndex]);
    } else {
        res.status(404).json({ message: 'Incident not found' });
    }
});

// POST /api/incidents/:id/notes
router.post('/:id/notes', async (req: express.Request, res: express.Response) => {
    const { note, userId, username } = req.body;
    if (!note || !userId || !username) {
        return res.status(400).json({ message: 'Note, userId, and username are required.' });
    }

    await ensureMockIncidents();
    const incidentIndex = mockIncidents.findIndex(inc => inc.id === req.params.id);

    if (incidentIndex > -1) {
        const newNote = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            userId,
            username,
            note,
        };
        mockIncidents[incidentIndex].activityLog.push(newNote);
        res.status(200).json(mockIncidents[incidentIndex]);
    } else {
        res.status(404).json({ message: 'Incident not found' });
    }
});

export default router;