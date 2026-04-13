import express from 'express';
import { getDb } from './database';
import { User, Role, Runbook } from './types';
import { protect } from './auth.routes';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

const router = express.Router();

// GET /api/runbooks
router.get('/', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const db = getDb();
    try {
        const rows = await db.all<any>(
            'SELECT * FROM runbooks WHERE "organizationId" = ? ORDER BY "createdAt" DESC',
            [authenticatedUser.organizationId]
        );
        const runbooks = rows.map((r: any) => ({
            ...r,
            config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
            enabled: Boolean(r.enabled)
        }));
        res.json(runbooks);
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

// POST /api/runbooks
router.post('/', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const { name, description, triggerType, config, enabled } = req.body;

    if (authenticatedUser.role === Role.MEMBER) {
        return res.status(403).json({ message: 'Only admins can create runbooks' });
    }

    if (!name || !triggerType) {
        return res.status(400).json({ message: 'Name and triggerType are required' });
    }

    const db = getDb();
    const id = crypto.randomUUID();

    try {
        await db.run(
            `INSERT INTO runbooks ("id", "organizationId", "name", "description", "triggerType", "config", "enabled")
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, authenticatedUser.organizationId, name, description, triggerType, JSON.stringify(config || {}), enabled !== false]
        );
        res.status(201).json({ id, message: 'Runbook created successfully' });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

// DELETE /api/runbooks/:id
router.delete('/:id', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const { id } = req.params;

    if (authenticatedUser.role === Role.MEMBER) {
        return res.status(403).json({ message: 'Only admins can delete runbooks' });
    }

    const db = getDb();
    try {
        await db.run(
            'DELETE FROM runbooks WHERE "id" = ? AND "organizationId" = ?',
            [id, authenticatedUser.organizationId]
        );
        res.status(200).json({ message: 'Runbook deleted successfully' });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

// POST /api/runbooks/:id/trigger
router.post('/:id/trigger', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const { id } = req.params;

    const db = getDb();
    try {
        const row = await db.get<any>(
            'SELECT * FROM runbooks WHERE "id" = ? AND "organizationId" = ?',
            [id, authenticatedUser.organizationId]
        );

        if (!row) {
            return res.status(404).json({ message: 'Runbook not found' });
        }

        const runbook: Runbook = {
            ...row,
            config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
            enabled: Boolean(row.enabled)
        };

        if (!runbook.enabled) {
            return res.status(400).json({ message: 'Runbook is disabled' });
        }

        // Logic to trigger webhook runbook
        if (runbook.triggerType === 'webhook') {
            const { url, method, headers, targetPayload } = runbook.config;
            if (!url) return res.status(400).json({ message: 'Webhook URL missing in config' });
            
            const response = await fetch(url, {
                method: method || 'POST',
                headers: headers || { 'Content-Type': 'application/json' },
                body: targetPayload ? JSON.stringify(targetPayload) : undefined
            } as any);
            
            if (!response.ok) {
                const text = await response.text();
                return res.status(response.status).json({ message: `Webhook failed: ${text}` });
            }
            
            return res.status(200).json({ message: 'Runbook triggered successfully' });
        } else {
            return res.status(400).json({ message: 'Unsupported trigger type for manual triggering' });
        }

    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

export default router;
