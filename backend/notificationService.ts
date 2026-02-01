import nodemailer from 'nodemailer';
import { Twilio } from 'twilio';
import fetch from 'node-fetch';
import { retry, withTimeout } from './resilience';

// --- Email Configuration (Generic SMTP) ---
// Falls back to SendGrid defaults if specific SMTP vars aren't provided
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
 * Sends a formatted Slack alert
 */
export const sendSlackAlert = async (webhookUrl: string, alertData: { title: string; message: string; severity: string; source: string }) => {
    const color = alertData.severity === 'CRITICAL' ? '#ff0000' : alertData.severity === 'ERROR' ? '#ff9900' : '#36a64f';
    
    const payload = {
        attachments: [
            {
                fallback: `AetherLog Alert: ${alertData.title}`,
                color: color,
                title: `🚨 ${alertData.title}`,
                text: alertData.message,
                fields: [
                    { title: "Severity", value: alertData.severity, short: true },
                    { title: "Source", value: alertData.source, short: true }
                ],
                footer: "AetherLog AI Monitoring",
                ts: Math.floor(Date.now() / 1000)
            }
        ]
    };

    return sendWebhook(webhookUrl, payload);
};