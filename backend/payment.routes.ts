import express from 'express';
import { getDb, PLAN_CONFIG } from './database';
import { Role, User, SubscriptionPlan } from './types';
import { protect } from './auth.routes';

const router = express.Router();

// --- Stripe Initialization ---
let stripe: any = null;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (STRIPE_SECRET_KEY) {
    try {
        const Stripe = require('stripe');
        stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
        console.log('✅ Stripe initialized successfully.');
    } catch (e) {
        console.warn('⚠️ Stripe initialization failed:', e);
    }
} else {
    console.warn('⚠️ STRIPE_SECRET_KEY not set. Payments will use simulated mode.');
}

// Stripe Price IDs mapped to plan names
const STRIPE_PRICE_IDS: Record<string, string> = {
    Pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder',
    Enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
};

// --- Stripe Webhook (NO auth, raw body for signature verification) ---
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: express.Request, res: express.Response) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ message: 'Stripe webhooks not configured.' });
    }

    const sig = req.headers['stripe-signature'];
    let event: any;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        console.error(`⚠️ Stripe webhook signature verification failed:`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const orgId = session.metadata?.organizationId;
            const planName = session.metadata?.planName as SubscriptionPlan;

            if (orgId && planName && PLAN_CONFIG[planName]) {
                const db = getDb();
                const newPlanDetails = PLAN_CONFIG[planName];
                await db.run(
                    'UPDATE organizations SET "plan" = ? WHERE "id" = ?',
                    [JSON.stringify(newPlanDetails), orgId]
                );
                console.log(`✅ [Stripe Webhook] Organization ${orgId} upgraded to ${planName}`);
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const orgId = subscription.metadata?.organizationId;
            if (orgId) {
                const db = getDb();
                const freePlan = PLAN_CONFIG['Free'];
                await db.run(
                    'UPDATE organizations SET "plan" = ? WHERE "id" = ?',
                    [JSON.stringify(freePlan), orgId]
                );
                console.log(`⚠️ [Stripe Webhook] Organization ${orgId} downgraded to Free`);
            }
            break;
        }
        default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// All remaining routes are protected
router.use(protect);

// POST /api/payment/create-session
router.post('/create-session', async (req: express.Request, res: express.Response) => {
    const user = (req as any).user as User;
    const { planName } = req.body as { planName: SubscriptionPlan };

    if (!planName || !Object.keys(PLAN_CONFIG).includes(planName)) {
        return res.status(400).json({ message: 'A valid planName is required.' });
    }

    if (planName === 'Free') {
        return res.status(400).json({ message: 'Cannot purchase the Free plan.' });
    }

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ message: 'You do not have permission to change the subscription plan.' });
    }

    const db = getDb();

    // --- Stripe Checkout Flow ---
    if (stripe && STRIPE_PRICE_IDS[planName] && !STRIPE_PRICE_IDS[planName].includes('placeholder')) {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{ price: STRIPE_PRICE_IDS[planName], quantity: 1 }],
                success_url: `${FRONTEND_URL}/dashboard?payment=success&plan=${planName}`,
                cancel_url: `${FRONTEND_URL}/billing?payment=cancelled`,
                metadata: {
                    organizationId: user.organizationId,
                    planName: planName,
                    userId: user.id,
                },
                customer_email: user.email,
            });

            console.log(`[Stripe] Checkout session created for org ${user.organizationId}, plan: ${planName}`);
            return res.status(200).json({
                mode: 'stripe',
                sessionId: session.id,
                url: session.url,
                message: 'Redirecting to Stripe Checkout...'
            });
        } catch (error: any) {
            console.error('[Stripe] Failed to create checkout session:', error);
            return res.status(500).json({ message: `Stripe error: ${error.message}` });
        }
    }

    // --- Simulated Payment Fallback ---
    try {
        const newPlanDetails = PLAN_CONFIG[planName];
        const result = await db.run(
            'UPDATE organizations SET "plan" = ? WHERE "id" = ?',
            [JSON.stringify(newPlanDetails), user.organizationId]
        );

        if (!result.changes || result.changes === 0) {
            return res.status(404).json({ message: 'Organization not found.' });
        }

        res.status(200).json({
            mode: 'simulated',
            message: `Successfully upgraded to ${planName} plan. (Simulated — add STRIPE_SECRET_KEY to enable real payments)`,
        });
    } catch (error) {
        console.error('Failed to upgrade plan:', error);
        res.status(500).json({ message: 'Server error during plan upgrade.' });
    }
});

// GET /api/payment/status
router.get('/status', async (_req: express.Request, res: express.Response) => {
    res.json({
        stripe_configured: !!stripe,
        mode: stripe ? 'live' : 'simulated',
        message: stripe
            ? 'Stripe is configured. Payments are processed securely via Stripe Checkout.'
            : 'Stripe is not configured. Payments are simulated for demo purposes.'
    });
});

export default router;