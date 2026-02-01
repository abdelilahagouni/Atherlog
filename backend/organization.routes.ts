import express from 'express';
import { getDb, getOrganizationWithDetails } from './database';
import { User, Role } from './types';
import { protect } from './auth.routes';

const router = express.Router();

// GET /api/organization/all-users (Protected, Super Admin only)
router.get('/all-users', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    if (authenticatedUser.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const db = getDb();
    try {
        const rows = await db.all<(
            Omit<User, 'password'> & { organizationName: string }
        )>(
            `SELECT 
                u."id",
                u."organizationId",
                u."username",
                u."role",
                u."email",
                u."jobTitle",
                u."salary",
                u."hireDate",
                u."notificationEmail",
                u."phone",
                u."isVerified",
                o."name" as "organizationName"
            FROM users u
            JOIN organizations o ON o."id" = u."organizationId"
            ORDER BY o."name" ASC, u."username" ASC`
        );

        return res.status(200).json(rows);
    } catch (e: any) {
        return res.status(500).json({ message: e.message });
    }
});

// GET /api/organization/settings (Protected)
router.get('/settings', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    
    try {
        const org = await getOrganizationWithDetails(authenticatedUser.organizationId);
        if (!org) return res.status(404).json({ message: 'Organization not found' });
        
        res.status(200).json({
            anomalyThreshold: org.anomalyThreshold,
            slackWebhookUrl: org.slackWebhookUrl,
            webhookUrl: org.webhookUrl
        });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

// PATCH /api/organization/settings (Protected, Admin only)
router.patch('/settings', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const { anomalyThreshold, slackWebhookUrl, webhookUrl } = req.body;
    
    if (authenticatedUser.role === Role.MEMBER) {
        return res.status(403).json({ message: 'Only admins can update organization settings' });
    }

    const db = getDb();
    try {
        await db.run(
            `UPDATE organizations SET 
                "anomalyThreshold" = COALESCE(?, "anomalyThreshold"),
                "slackWebhookUrl" = COALESCE(?, "slackWebhookUrl"),
                "webhookUrl" = COALESCE(?, "webhookUrl")
             WHERE "id" = ?`,
            [anomalyThreshold, slackWebhookUrl, webhookUrl, authenticatedUser.organizationId]
        );
        
        res.status(200).json({ message: 'Organization settings updated successfully' });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

export default router;