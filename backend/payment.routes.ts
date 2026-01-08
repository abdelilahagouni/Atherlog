import express from 'express';
import { getDb, PLAN_CONFIG } from './database';
import { Role, User, SubscriptionPlan } from './types';
import { protect } from './auth.routes';

const router = express.Router();

// All routes are protected
router.use(protect);

// POST /api/payment/create-session
// This endpoint simulates a successful payment and upgrades the user's plan.
router.post('/create-session', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const { planName } = req.body as { planName: SubscriptionPlan };

    if (!planName || !Object.keys(PLAN_CONFIG).includes(planName)) {
        return res.status(400).json({ message: 'A valid planName is required.' });
    }

    // In a real app, only admins/owners should be able to upgrade.
    if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ message: 'You do not have permission to change the subscription plan.' });
    }

    const db = getDb();
    try {
        const newPlanDetails = PLAN_CONFIG[planName];
        
        const result = await db.run(
            'UPDATE organizations SET "plan" = ? WHERE "id" = ?',
            [JSON.stringify(newPlanDetails), user.organizationId]
        );

        if (!result.changes || result.changes === 0) {
            return res.status(404).json({ message: 'Organization not found.' });
        }

        // Simulate a successful response after payment processing
        res.status(200).json({ message: `Successfully upgraded to ${planName} plan.` });

    } catch (error) {
        console.error('Failed to upgrade plan:', error);
        res.status(500).json({ message: 'Server error during plan upgrade.' });
    }
});

export default router;