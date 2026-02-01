
import { getDb } from './database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service to handle email bounces, complaints, and suppression lists.
 * This ensures we stop sending to bad addresses to protect sender reputation.
 */

export const isSuppressed = async (email: string, organizationId: string): Promise<boolean> => {
    const db = getDb();
    const result = await db.all(
        'SELECT email FROM email_suppressions WHERE email = $1 AND "organizationId" = $2', 
        [email, organizationId]
    );
    return (result && result.length > 0);
};

export const addToSuppressionList = async (email: string, organizationId: string, reason: string) => {
    const db = getDb();
    
    // Check if already suppressed to avoid duplicates
    if (await isSuppressed(email, organizationId)) {
        console.log(`[BounceService] Email ${email} is already suppressed.`);
        return;
    }

    await db.run(
        'INSERT INTO email_suppressions (email, "organizationId", reason) VALUES ($1, $2, $3)',
        [email, organizationId, reason]
    );
    console.log(`[BounceService] Added ${email} to suppression list. Reason: ${reason}`);
};

export const logEmailEvent = async (email: string, organizationId: string, event: string, reason?: string) => {
    const db = getDb();
    const id = uuidv4();
    
    await db.run(
        'INSERT INTO email_events (id, "organizationId", email, event, reason) VALUES ($1, $2, $3, $4, $5)',
        [id, organizationId, email, event, reason || null]
    );
};

export const handleWebhookEvent = async (eventType: string, email: string, reason: string, organizationId: string) => {
    await logEmailEvent(email, organizationId, eventType, reason);

    // If it's a permanent failure, suppress it
    if (['bounce', 'spam_report', 'blocked'].includes(eventType)) {
        await addToSuppressionList(email, organizationId, `Webhook Event: ${eventType} - ${reason}`);
    }
};
