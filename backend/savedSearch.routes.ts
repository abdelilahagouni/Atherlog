// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import { getDb } from './database';
import { SavedSearch, User } from './types';
import { protect } from './auth.routes';
import * as crypto from 'crypto';

const router = express.Router();

// All routes are protected
router.use(protect);

// GET /api/searches
router.get('/', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const db = getDb();
    try {
        const searches = await db.all<SavedSearch>(
            'SELECT * FROM saved_searches WHERE "organizationId" = ? ORDER BY "createdAt" DESC',
            [user.organizationId]
        );
        res.status(200).json(searches);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve saved searches.' });
    }
});

// POST /api/searches
router.post('/', async (req: express.Request, res: express.Response) => {
    const { name, query } = req.body;
    if (!name || !query) {
        return res.status(400).json({ message: 'Search name and query object are required.' });
    }
    const user = (req as any).user as User;
    const db = getDb();
    
    try {
        const newSearch: SavedSearch = {
            id: crypto.randomUUID(),
            name,
            query,
            userId: user.id,
            organizationId: user.organizationId,
            createdAt: new Date().toISOString()
        };
        await db.run(
            'INSERT INTO saved_searches ("id", "name", "query", "userId", "organizationId") VALUES (?, ?, ?, ?, ?)',
            [newSearch.id, newSearch.name, JSON.stringify(newSearch.query), newSearch.userId, newSearch.organizationId]
        );
        res.status(201).json(newSearch);
    } catch (error) {
        res.status(500).json({ message: 'Failed to save search.' });
    }
});

// DELETE /api/searches/:id
router.delete('/:id', async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const user = (req as any).user as User;
    const db = getDb();
    
    try {
        const result = await db.run(
            'DELETE FROM saved_searches WHERE "id" = ? AND "organizationId" = ?',
            [id, user.organizationId]
        );
        if (!result.changes || result.changes === 0) {
            return res.status(404).json({ message: 'Saved search not found or you do not have permission to delete it.' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete saved search.' });
    }
});

export default router;