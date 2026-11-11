import nodemailer from 'nodemailer';
import { Twilio } from 'twilio';
import fetch from 'node-fetch';
import { retry, withTimeout } from './resilience';

// --- Email Configuration (Generic SMTP) ---
// Falls back to SendGrid defaults if specific SMTP vars aren't provided

// TEST_MODE=true blocks EVERY outgoing notification (e-mail, SMS, webhook, Slack, Teams, Telegram).
// Test scripts refuse to run unless the backend reports testMode: true on /api/health.
export const isTestMode = (): boolean => process.env.TEST_MODE === 'true';
const blockedInTestMode = (channel: string): boolean => {
    if (isTestMode()) {
        console.log(`[TEST_MODE] ${channel} notification blocked (TEST_MODE=true).`);
        return true;
    }
    return false;
};

const emailFrom = process.env.EMAIL_FROM_ADDRESS;
const smtpHost = process.env.SMTP_HOST || 'smtp.sendgrid.net';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || 'apikey'; // 'apikey' is the username for SendGrid
const smtpPass = process.env.SMTP_PASS || process.env.SENDGRID_API_KEY;

let mailTransporter: nodemailer.Transporter | null = null;

if (smtpPass && emailFrom) {
    mailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
    console.log(`Email service configured via SMTP (${smtpHost}).`);
} else {
    console.warn("Email service not configured. Missing SMTP_PASS (or SENDGRID_API_KEY) or EMAIL_FROM_ADDRESS.");
}

// --- SMS Configuration (Twilio) ---
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
let twilioClient: Twilio | null = null;

if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    twilioClient = new Twilio(twilioAccountSid, twilioAuthToken);
    console.log("SMS service (Twilio) configured.");
} else {
    console.warn("SMS service not configured. Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER environment variables.");
}


interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}

import { validateEmailForSending } from './emailValidationService';
import { logEmailEvent } from './bounceService';

// ... imports ...

export const sendEmail = async (options: EmailOptions): Promise<void> => {
    if (blockedInTestMode('email')) return;
    if (!mailTransporter || !emailFrom) {
        const message = 'Email service is not configured on the server.';
        console.error(message);
        throw new Error(message);
    }

    // --- NEW: Validation and Suppression Check ---
    // For now, we assume a default or system org 'system' for transactional emails
    // In a real app, you'd pass organizationId in EmailOptions
    const validation = await validateEmailForSending(options.to, 'system');
    
    if (!validation.isValid) {
        const msg = `Email sending blocked: ${validation.error}`;
        console.warn(`[Detailed] ${msg} (to: ${options.to})`);
        
        // Log the blocked attempt
        await logEmailEvent(options.to, 'system', 'blocked', validation.error);
        throw new Error(msg);
    }
    // ---------------------------------------------

    await retry(async () => {
        await withTimeout(
            mailTransporter!.sendMail({
                from: `AetherLog <${emailFrom}>`,
                ...options
            }),
            parseInt(process.env.SMTP_TIMEOUT_MS || '10000', 10),
            'smtp'
        );
    }, {
        attempts: parseInt(process.env.SMTP_RETRY_ATTEMPTS || '2', 10),
        initialDelayMs: 500,
        backoffFactor: 2,
        breakerKey: 'smtp'
    });
    
    console.log(`Email sent to ${options.to} with subject "${options.subject}"`);
    await logEmailEvent(options.to, 'system', 'sent', 'Delivered to SMTP server');
};


export const sendSms = async (to: string, body: string): Promise<void> => {
    if (blockedInTestMode('SMS')) return;
    if (!twilioClient || !twilioPhoneNumber) {
        const message = 'SMS service is not configured on the server.';
        console.error(message);
        throw new Error(message);
    }
    await twilioClient.messages.create({
        body,
        from: twilioPhoneNumber,
        to,
    });
    console.log(`SMS sent to ${to}`);
};

export const sendVerificationEmail = async (userEmail: string, token: string, username: string): Promise<void> => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/#/verify-email?token=${token}`;
    const subject = "Welcome to AetherLog! Please Verify Your Email";
    const text = `Hello ${username},\n\nWelcome! Please verify your email by clicking this link: ${verificationLink}\n\nIf you did not sign up for an account, you can safely ignore this email.`;
    const html = `
        <h1>Welcome, ${username}!</h1>
        <p>Thanks for signing up for AetherLog. Please click the button below to verify your email address and activate your account.</p>
        <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">If you did not sign up for an account, you can safely ignore this email.</p>
    `;
    
    await sendEmail({ to: userEmail, subject, text, html });
};

/**
 * Sends a generic webhook notification
 */
export const sendWebhook = async (url: string, payload: any): Promise<void> => {
    if (blockedInTestMode('webhook')) return;
    await retry(async () => {
        const controller = new AbortController();
        const timeoutMs = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '8000', 10);
        const t = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal as any,
            } as any);
            if (!response.ok) {
                throw new Error(`Webhook failed with status ${response.status}`);
            }
        } finally {
            if (t) clearTimeout(t);
        }
    }, {
        attempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '2', 10),
        initialDelayMs: 500,
        backoffFactor: 2,
        breakerKey: 'webhook'
    });
    console.log(`Webhook sent successfully to ${url}`);
};

/**
 * Sends a formatted Slack alert using Block Kit for richer display
 */
export const sendSlackAlert = async (webhookUrl: string, alertData: { title: string; message: string; severity: string; source: string }) => {
    if (blockedInTestMode('Slack')) return;
    const isCritical = alertData.severity === 'CRITICAL' || alertData.severity === 'FATAL';
    const color = isCritical ? '#ff0000' : alertData.severity === 'ERROR' ? '#ff9900' : '#36a64f';
    const emoji = isCritical ? '🔥' : alertData.severity === 'ERROR' ? '🚨' : '⚠️';
    
    // Rich block kit payload
    const payload = {
        text: `${emoji} AetherLog Alert: ${alertData.title}`,
        blocks: [
            {
                type: 'header',
                text: { type: 'plain_text', text: `${emoji} ${alertData.title}`, emoji: true }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Severity*\n${alertData.severity}` },
                    { type: 'mrkdwn', text: `*Source*\n${alertData.source}` }
                ]
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Message:*\n\`\`\`${alertData.message}\`\`\`` }
            },
            { type: 'divider' },
            {
                type: 'context',
                elements: [
                    { type: 'mrkdwn', text: `AetherLog AI Observability • ${new Date().toISOString()}` }
                ]
            }
        ]
    };

    return sendWebhook(webhookUrl, payload);
};

/**
 * Sends a formatted Microsoft Teams alert using Adaptive Cards
 */
export const sendTeamsAlert = async (webhookUrl: string, alertData: { title: string; message: string; severity: string; source: string }) => {
    if (blockedInTestMode('Teams')) return;
    const isCritical = alertData.severity === 'CRITICAL' || alertData.severity === 'FATAL';
    const color = isCritical ? 'FF0000' : 'FF9900';
    
    // Adaptive Card payload format for Teams generic webhook
    const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        'themeColor': color,
        'summary': `AetherLog Alert: ${alertData.title}`,
        'sections': [{
            'activityTitle': `🚨 **${alertData.title}**`,
            'activitySubtitle': 'AetherLog AI Notification',
            'facts': [
                { 'name': 'Severity:', 'value': alertData.severity },
                { 'name': 'Source:', 'value': alertData.source }
            ],
            'markdown': true
        }],
        'text': `**Message:**\n\n${alertData.message}`
    };

    return sendWebhook(webhookUrl, payload);
};

/**
 * Sends a FATAL log alert to a Telegram chat via bot.
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env
 */
export const sendTelegramFatalAlert = async (log: {
    id: string;
    message: string;
    source: string;
    organizationId: string;
    timestamp: string;
    level: string;
    anomalyScore?: number | null;
}, heading = 'FATAL ALERT'): Promise<void> => {
    if (blockedInTestMode('Telegram')) return;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        console.warn('[Telegram] Bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
        return;
    }

    const time = new Date(log.timestamp).toLocaleString('en-GB', { timeZone: 'UTC' });
    // null/undefined = not scored: never shown as 0%.
    const anomalyPct = typeof log.anomalyScore === 'number' && Number.isFinite(log.anomalyScore)
        ? `${(log.anomalyScore * 100).toFixed(1)}% (${log.anomalyScore.toFixed(3)})` : 'not scored';

    const text = [
        `🚨 *${heading} — AetherLog*`,
        ``,
        `⏰ *Time:* ${time} UTC`,
        `📦 *Source:* \`${log.source}\``,
        `🔥 *Anomaly Score:* ${anomalyPct}`,
        ``,
        `💬 *Message:*`,
        `\`\`\``,
        log.message,
        `\`\`\``,
    ].join('\n');

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
        }),
    } as any);

    if (!response.ok) {
        const err = await response.text();
        console.error('[Telegram] Failed to send alert:', err);
        throw new Error(`Telegram API error: ${err}`);
    }

    console.log(`[Telegram] FATAL alert sent for log ${log.id}`);
};