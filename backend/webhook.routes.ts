
import express from 'express';
import { handleWebhookEvent } from './bounceService';
import { getDb } from './database';

const router = express.Router();

/**
 * POST /api/webhooks/email
 * Receives webhook events from Email Service Providers (ESP).
 * Schema fits generic providers (SendGrid/Resend style).
 */
router.post('/email', async (req: express.Request, res: express.Response) => {
    try {
        const events = Array.isArray(req.body) ? req.body : [req.body];
        
        console.log(`[EmailWebhook] Received ${events.length} events in batch.`);

        for (const event of events) {
            // Normalized event extraction
            // Providers differ: SendGrid uses 'email', Resend 'to', etc.
            const email = event.email || (event.to && event.to[0]) || event.recipient;
            const type = event.type || event.event; // 'bounce', 'spam_report', 'delivered'
            const reason = event.reason || event.description || 'No reason provided';
            
            // NOTE: In a real system, we'd verify the webhook signature here.
            
            if (email && type) {
                // Find organization for this email context.
                // For MVP, we'll try to find an org that has a user with this email
                // or just attach to a system-level 'global' suppression if org is unknown.
                const db = getDb();
                
                // Try to link to an org via user search
                const userRes = await db.all<{ organizationId: string }>('SELECT "organizationId" FROM users WHERE email = $1 LIMIT 1', [email]);
                let orgId = ''; // Will determine below
                
                if (userRes && userRes.length > 0) {
                    orgId = userRes[0].organizationId;
                } else {
                    // Fallback: Get ANY valid org to attach this event to (for system logs)
                    // In a real multi-tenant system, this might go to a specific 'Admin' org
                    const anyOrg = await db.all<{ id: string }>('SELECT id FROM organizations LIMIT 1');
                    if (anyOrg && anyOrg.length > 0) {
                        orgId = anyOrg[0].id;
                    } else {
                        console.warn('[EmailWebhook] No organizations found to attach event to.');
                        continue; // Skip if no orgs exist at all
                    }
                }

                await handleWebhookEvent(type, email, reason, orgId);
                console.log(`[EmailWebhook] Processed event: ${type} for ${email}`);
            } else {
                console.warn('[EmailWebhook] Unknown event format:', event);
            }
        }

        res.status(200).send('Webhook processed');

    } catch (error: any) {
        console.error('[EmailWebhook] Error processing webhook:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
