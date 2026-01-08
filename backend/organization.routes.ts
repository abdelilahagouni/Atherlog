// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import { getDb } from './database';
import { Role, User } from './types';
import { protect } from './auth.routes';

const router = express.Router();

// GET /api/organization/members (Protected)
router.get('/members', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const db = getDb();

    try {
        const members = await db.all<Omit<User, 'password'>>(
            'SELECT "id", "organizationId", "username", "role", "email", "jobTitle" FROM users WHERE "organizationId" = ?',
            [authenticatedUser.organizationId]
        );
        res.status(200).json(members);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error fetching organization members.' });
    }
});


// GET /api/organization/all-users (Protected, Super Admin only)
router.get('/all-users', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;

    // This is a highly privileged route, so we perform an explicit role check.
    if (authenticatedUser.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Forbidden: Access is restricted to Super Admins.' });
    }

    const db = getDb();
    try {
        // Join users and organizations tables to get all data needed for the admin panel
        const allUsers = await db.all<User & { organizationName: string }>(`
            SELECT 
                u.*, 
                o.name as "organizationName"
            FROM users u
            JOIN organizations o ON u."organizationId" = o.id
            ORDER BY o.name, u.username
        `);

        // Remove passwords before sending the response
        const safeUsers = allUsers.map(user => {
            delete (user as Partial<User>).password;
            return user;
        });

        res.status(200).json(safeUsers);
    } catch (e) {
        console.error('Super Admin fetch all users failed:', e);
        res.status(500).json({ message: 'Server error fetching all user data.' });
    }
});


export default router;