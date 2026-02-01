// pipeline.routes.ts - API routes for managing log processing pipelines
import express from 'express';
import { getDb } from './database';
import { protect as authenticateToken } from './auth.routes';
import * as crypto from 'crypto';

const router = express.Router();

// Get all pipelines for the organization
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
    const organizationId = (req as any).user.organizationId;
    const db = getDb();

    try {
        const pipelines = await db.all(
            'SELECT * FROM log_pipelines WHERE "organizationId" = ? ORDER BY "order" ASC',
            [organizationId]
        );
        res.json(pipelines);
    } catch (error) {
        console.error('Failed to fetch pipelines:', error);
        res.status(500).json({ message: 'Failed to fetch pipelines.' });
    }
});

// Update a pipeline (toggle enabled)
router.patch('/:id', authenticateToken, async (req: express.Request, res: express.Response) => {
    const organizationId = (req as any).user.organizationId;
    const { id } = req.params;
    const { enabled, rules, name, description } = req.body;
    const db = getDb();

    try {
        const updates: string[] = [];
        const params: any[] = [];

        if (enabled !== undefined) {
            updates.push('"enabled" = ?');
            params.push(enabled);
        }
        if (rules !== undefined) {
            updates.push('"rules" = ?');
            params.push(JSON.stringify(rules));
        }
        if (name !== undefined) {
            updates.push('"name" = ?');
            params.push(name);
        }
        if (description !== undefined) {
            updates.push('"description" = ?');
            params.push(description);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No updates provided.' });
        }

        updates.push('"updatedAt" = NOW()');
        params.push(id, organizationId);

        const sql = `UPDATE log_pipelines SET ${updates.join(', ')} WHERE "id" = ? AND "organizationId" = ?`;
        await db.run(sql, params);

        res.json({ message: 'Pipeline updated.' });
    } catch (error) {
        console.error('Failed to update pipeline:', error);
        res.status(500).json({ message: 'Failed to update pipeline.' });
    }
});

// Create a new pipeline
router.post('/', authenticateToken, async (req: express.Request, res: express.Response) => {
    const organizationId = (req as any).user.organizationId;
    const { name, description, rules } = req.body;
    const db = getDb();

    try {
        const id = crypto.randomUUID();
        await db.run(
            'INSERT INTO log_pipelines ("id", "organizationId", "name", "description", "rules") VALUES (?, ?, ?, ?, ?)',
            [id, organizationId, name, description, JSON.stringify(rules || [])]
        );
        res.status(201).json({ id, message: 'Pipeline created.' });
    } catch (error) {
        console.error('Failed to create pipeline:', error);
        res.status(500).json({ message: 'Failed to create pipeline.' });
    }
});

export default router;
