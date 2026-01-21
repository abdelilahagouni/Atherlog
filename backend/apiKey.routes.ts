// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import bcrypt from 'bcryptjs';
// FIX: Import Buffer to resolve missing type definition for Node.js global.
import { Buffer } from 'buffer';
import { getDb } from './database';
import { ApiKey, Role, User } from './types';
import { protect } from './auth.routes';
import * as crypto from 'crypto';

const router = express.Router();

// All routes in this file are protected
router.use(protect);

// Middleware to ensure user is an Admin or Owner
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as User;
    if (user.role !== Role.ADMIN && user.role !== Role.OWNER && user.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to manage API keys.' });
    }
    next();
};

// GET /api/keys
router.get('/', requireAdmin, async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();
    try {
        const keys = await db.all<ApiKey>(
            'SELECT "id", "name", "keyPrefix", "organizationId", "createdAt", "lastUsed" FROM api_keys WHERE "organizationId" = ? ORDER BY "createdAt" DESC',
            [user.organizationId]
        );
        res.status(200).json(keys);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve API keys.' });
    }
});

// POST /api/keys
router.post('/', requireAdmin, async (req: express.Request, res: express.Response) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Key name is required.' });
    }
    const user = (req as any).user as User;
    const db = getDb();

    // Generate a secure, URL-safe API key
    const rawKey = `aial_${Buffer.from(crypto.randomUUID()).toString('base64url')}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await bcrypt.hash(rawKey, 10);
    
    try {
        const newKeyId = crypto.randomUUID();
        await db.run(
            'INSERT INTO api_keys ("id", "name", "keyHash", "keyPrefix", "organizationId") VALUES (?, ?, ?, ?, ?)',
            [newKeyId, name, keyHash, keyPrefix, user.organizationId]
        );
        // Return the raw key to the user ONCE. They must save it.
        res.status(201).json({ id: newKeyId, name, rawKey });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create API key.' });
    }
});

// DELETE /api/keys/:id
router.delete('/:id', requireAdmin, async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const user = (req as any).user as User;
    const db = getDb();
    
    try {
        const result = await db.run(
            'DELETE FROM api_keys WHERE "id" = ? AND "organizationId" = ?',
            [id, user.organizationId]
        );
        if (!result.changes || result.changes === 0) {
            return res.status(404).json({ message: 'API key not found or you do not have permission to delete it.' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete API key.' });
    }
});

export default router;