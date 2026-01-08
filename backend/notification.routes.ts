// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import { getDb } from './database';
import { LogEntry, Role, User } from './types';
import { protect } from './auth.routes';
import { sendEmail, sendSms, sendWebhook, sendSlackAlert } from './notificationService';

const router = express.Router();

// POST /api/notifications/test (Protected)
router.post('/test', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const db = getDb();

    try {
        const user = await db.get<User>('SELECT * FROM users WHERE "id" = ?', [authenticatedUser.id]);

        if (!user) return res.status(404).json({ message: 'User not found' });
        
        const email = user.notificationEmail || user.email;
        const phone = user.phone;
        const subject = 'Test Alert: AI Log Analyzer';
        const message = "This is a test alert from AI Log Analyzer. Your notification settings are working correctly.";

        await sendEmail({ to: email, subject, text: message, html: `<p>${message}</p>` });

        if (phone) {
            await sendSms(phone, `AI Log Analyzer: ${message}`);
        }

        res.status(200).json({ message: 'Test notification sent. Check your email/phone.' });

    } catch (e: any) {
        console.error('Error sending test notification:', e.message);
        res.status(500).json({ message: e.message || 'Server error during test notification.' });
    }
});

// POST /api/notifications/fatal-error (Protected)
router.post('/fatal-error', protect, async (req: express.Request, res: express.Response) => {
    const { logEntry } = req.body as { logEntry: LogEntry };
    if (!logEntry) {
        return res.status(400).json({ message: 'logEntry is required' });
    }

    const db = getDb();
    const authenticatedUser = (req as any).user as User;

    try {
        // Find all users in the organization who should be notified
        const recipients = await db.all<User>(
            'SELECT * FROM users WHERE "organizationId" = ? AND "role" IN (?, ?, ?, ?)',
            [authenticatedUser.organizationId, Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]
        );
        
        if (recipients.length === 0) {
            console.warn("No recipients found for fatal error alert in organization:", authenticatedUser.organizationId);
            return res.status(200).json({ message: 'No eligible recipients found to notify.' });
        }
        
        const subject = `🚨 FATAL ERROR Detected in ${logEntry.source}`;
        const textMessage = `FATAL ERROR in ${logEntry.source}: ${logEntry.message}`;
        const htmlMessage = `
            <h2>🚨 Fatal Error Detected</h2>
            <p>A fatal error was detected in your application with the following details:</p>
            <ul>
                <li><strong>Timestamp:</strong> ${new Date(logEntry.timestamp).toLocaleString()}</li>
                <li><strong>Source:</strong> ${logEntry.source}</li>
                <li><strong>Level:</strong> ${logEntry.level}</li>
                <li><strong>Anomaly Score:</strong> ${logEntry.anomalyScore?.toFixed(3) ?? 'N/A'}</li>
            </ul>
            <pre style="background-color: #f0f0f0; padding: 10px; border-radius: 5px;">${logEntry.message}</pre>
            <p>Please investigate immediately.</p>
        `;
        
        const notificationPromises: Promise<any>[] = [];

        for (const recipient of recipients) {
            const email = recipient.notificationEmail || recipient.email;
            notificationPromises.push(sendEmail({ to: email, subject, text: textMessage, html: htmlMessage }));
            
            if (recipient.phone) {
                notificationPromises.push(sendSms(recipient.phone, `AI Log Analyzer Alert: ${textMessage}`));
            }
        }

        await Promise.all(notificationPromises);
        
        res.status(200).json({ message: 'Fatal error alerts dispatched.' });

    } catch (e: any) {
        console.error('Error dispatching fatal error notifications:', e.message);
        res.status(500).json({ message: e.message || 'Server error during alert dispatch.' });
    }
});

// POST /api/notifications/test-webhook (Protected)
router.post('/test-webhook', protect, async (req: express.Request, res: express.Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'Webhook URL is required' });

    try {
        await sendWebhook(url, {
            event: 'test_notification',
            message: 'This is a test webhook from AetherLog.',
            timestamp: new Date().toISOString()
        });
        res.status(200).json({ message: 'Test webhook sent successfully.' });
    } catch (e: any) {
        res.status(500).json({ message: `Failed to send webhook: ${e.message}` });
    }
});

// POST /api/notifications/test-slack (Protected)
router.post('/test-slack', protect, async (req: express.Request, res: express.Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'Slack Webhook URL is required' });

    try {
        await sendSlackAlert(url, {
            title: 'Test Alert',
            message: 'This is a test Slack notification from AetherLog.',
            severity: 'INFO',
            source: 'AetherLog Dashboard'
        });
        res.status(200).json({ message: 'Test Slack alert sent successfully.' });
    } catch (e: any) {
        res.status(500).json({ message: `Failed to send Slack alert: ${e.message}` });
    }
});

export default router;