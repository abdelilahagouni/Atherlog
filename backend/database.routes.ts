import express from 'express';
import { Pool } from 'pg';
import { getDb } from './database';
import { Role, User, QueryResult } from './types';
import { protect } from './auth.routes';

const router = express.Router();

// Middleware to ensure user is an Admin or Owner
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as User;
    if (user.role !== Role.ADMIN && user.role !== Role.OWNER && user.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to access the database explorer.' });
    }
    next();
};

router.use(protect, requireAdmin);

// POST /api/database/execute
router.post('/execute', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const { sql } = req.body;

    if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ message: 'SQL query string is required.' });
    }

    const trimmedSql = sql.trim().toUpperCase();
    const isSelectQuery = trimmedSql.startsWith('SELECT');

    // Basic security check for highly destructive commands
    const disallowedKeywords = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE USER', 'GRANT'];
    if (disallowedKeywords.some(keyword => trimmedSql.includes(keyword))) {
        return res.status(403).json({ message: `Destructive command "${disallowedKeywords.find(k => trimmedSql.includes(k))}" is not allowed.` });
    }

    // This is a simplified multi-tenancy enforcement for demonstration.
    // A production system would use more robust SQL parsing or database-level row policies.
    if (isSelectQuery && !sql.includes(user.organizationId)) {
       if (
         sql.includes('"users"') || 
         sql.includes('"logs"') || 
         sql.includes('"api_keys"') || 
         sql.includes('"saved_searches"') ||
         sql.includes('"incidents"')
        ) {
         return res.status(403).json({ message: `Query must be scoped to your organization. Try adding: WHERE "organizationId" = '${user.organizationId}'` });
       }
    }

    // In a real app, you would use a read-only transaction for SELECTs
    const db = getDb();
    try {
        // We cannot use the getDb() wrapper here because it transforms '?' placeholders,
        // which we don't want for raw SQL execution. We need direct pool access.
        const pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5434'),
            user: process.env.POSTGRES_USER || 'admin',
            password: process.env.POSTGRES_PASSWORD || 'password123',
            database: process.env.POSTGRES_DB || 'ailoganalyzer',
        });
        const result = await pool.query(sql);
        await pool.end();

        const response: QueryResult = {};

        if (isSelectQuery) {
            response.rows = result.rows;
            response.columns = result.fields.map(field => field.name);
        } else {
            response.message = `${result.rowCount} rows affected.`;
        }
        
        res.status(200).json(response);

    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

export default router;