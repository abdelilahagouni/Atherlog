import { LogEntry, Organization, Role, User } from './types';
import { getDb, getOrganizationWithDetails } from './database';
import { sendEmail, sendSlackAlert, sendWebhook } from './notificationService';

export const checkAndAlert = async (log: LogEntry) => {
    const db = getDb();
    const org = await getOrganizationWithDetails(log.organizationId);

    if (!org) return;

    const threshold = org.anomalyThreshold ?? 0.7;
    const score = log.anomalyScore ?? 0;

    if (score >= threshold) {
        console.log(`🚨 Anomaly detected! Score: ${score}, Threshold: ${threshold}. Triggering alerts for org: ${org.name}`);

        // 1. Send Email to Admins
        try {
            const admins = await db.all<User>(
                'SELECT * FROM users WHERE "organizationId" = ? AND "role" IN (?, ?, ?, ?)',
                [org.id, Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]
            );

            const subject = `🚨 AI Alert: High Anomaly Detected in ${log.source}`;
            const html = `
                <h2>🚨 High Anomaly Detected</h2>
                <p>AetherLog AI has detected a significant anomaly in your system.</p>
                <ul>
                    <li><strong>Anomaly Score:</strong> ${score.toFixed(3)}</li>
                    <li><strong>Threshold:</strong> ${threshold.toFixed(2)}</li>
                    <li><strong>Source:</strong> ${log.source}</li>
                    <li><strong>Level:</strong> ${log.level}</li>
                    <li><strong>Timestamp:</strong> ${new Date(log.timestamp).toLocaleString()}</li>
                </ul>
                <p><strong>Message:</strong></p>
                <pre style="background-color: #f0f0f0; padding: 10px; border-radius: 5px;">${log.message}</pre>
                <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/incidents" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Incident Center</a></p>
            `;

            for (const admin of admins) {
                const email = admin.notificationEmail || admin.email;
                await sendEmail({ to: email, subject, text: `Anomaly detected: ${log.message}`, html });
            }
        } catch (e: any) {
            console.error('Failed to send anomaly emails:', e.message);
        }

        // 2. Send Slack Alert
        if (org.slackWebhookUrl) {
            try {
                await sendSlackAlert(org.slackWebhookUrl, {
                    title: 'High Anomaly Detected',
                    message: log.message,
                    severity: 'CRITICAL',
                    source: log.source
                });
            } catch (e: any) {
                console.error('Failed to send Slack alert:', e.message);
            }
        }

        // 3. Send Generic Webhook
        if (org.webhookUrl) {
            try {
                await sendWebhook(org.webhookUrl, {
                    event: 'anomaly_detected',
                    log: log,
                    threshold: threshold,
                    timestamp: new Date().toISOString()
                });
            } catch (e: any) {
                console.error('Failed to send generic webhook:', e.message);
            }
        }
    }
};
