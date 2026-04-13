import { LogEntry, LogLevel, Role, User } from './types';
import { getDb, getOrganizationWithDetails } from './database';
import { sendEmail, sendSlackAlert, sendTeamsAlert, sendWebhook, sendTelegramFatalAlert } from './notificationService';
import { alertQueue, runbookQueue } from './jobQueue';
import { fetchJsonWithRetry } from './resilience';

type AlertType = 'fatal' | 'anomaly_high';

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

const getPythonServiceUrl = () => {
    let url = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    if (!url.startsWith('http')) {
        url = `http://${url}`;
    }
    return url.replace(/\/$/, '');
};

const ALERT_LIMIT_PER_HOUR = 5;

const shouldSendAlert = async (organizationId: string, type: AlertType, source: string | null) => {
    const db = getDb();
    
    // 1. Check Hourly Limit (Max 5 alerts per hour)
    const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const hourlySent = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM alert_events WHERE "organizationId" = ? AND "createdAt" >= ? AND (payload->>\'suppressed\')::boolean = false',
        [organizationId, lastHour]
    );

    if (hourlySent && hourlySent.count >= ALERT_LIMIT_PER_HOUR) {
        console.warn(`[Alerts] Hourly limit reached for org ${organizationId} (${hourlySent.count} alerts sent). Suppressing.`);
        return false;
    }

    // 2. Check Cooldown (Original logic)
    const row = await db.get<{ lastSentAt: string }>(
        'SELECT "lastSentAt" FROM alert_cooldowns WHERE "organizationId" = ? AND "type" = ? AND "source" IS NOT DISTINCT FROM ?',
        [organizationId, type, source]
    );

    if (!row?.lastSentAt) return true;
    const last = new Date(row.lastSentAt).getTime();
    return Date.now() - last >= ALERT_COOLDOWN_MS;
};

const markAlertSent = async (organizationId: string, type: AlertType, source: string | null) => {
    const db = getDb();
    const id = `${organizationId}:${type}:${source ?? ''}`;
    await db.run(
        `INSERT INTO alert_cooldowns ("id", "organizationId", "type", "source", "lastSentAt", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())
         ON CONFLICT ("organizationId", "type", "source")
         DO UPDATE SET "lastSentAt" = NOW(), "updatedAt" = NOW()`,
        [id, organizationId, type, source]
    );
};

const createAlertEvent = async (organizationId: string, type: AlertType, severity: 'CRITICAL' | 'HIGH', source: string | null, logId: string | null, payload: any) => {
    const db = getDb();
    const id = `${logId ?? ''}:${type}:${Date.now()}`;
    await db.run(
        'INSERT INTO alert_events ("id", "organizationId", "type", "severity", "source", "logId", "payload") VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, organizationId, type, severity, source, logId, JSON.stringify(payload ?? {})]
    );
    return id;
};

const getAiGuidanceHtml = async (log: LogEntry) => {
    try {
        const pythonServiceUrl = getPythonServiceUrl();
        const [rca, playbook] = await Promise.all([
            fetchJsonWithRetry<any>(`${pythonServiceUrl}/rca`, { targetLog: log, logHistory: [] }, { breakerKey: 'python-rca', attempts: 2, timeoutMs: 8000 }),
            fetchJsonWithRetry<any>(`${pythonServiceUrl}/playbook`, { targetLog: log }, { breakerKey: 'python-playbook', attempts: 2, timeoutMs: 8000 }),
        ]);

        const rcaSummary = rca?.summary ? String(rca.summary) : '';
        const nextSteps = Array.isArray(rca?.nextSteps) ? rca.nextSteps : [];
        const playbookTitle = playbook?.title ? String(playbook.title) : '';
        const triageSteps = Array.isArray(playbook?.triageSteps) ? playbook.triageSteps : [];

        const nextStepsHtml = nextSteps.length
            ? `<ol>${nextSteps.map((s: any) => `<li>${String(s)}</li>`).join('')}</ol>`
            : '';
        const triageHtml = triageSteps.length
            ? `<ol>${triageSteps.map((s: any) => `<li>${String(s?.action ?? '')}${s?.command ? `<br/><code>${String(s.command)}</code>` : ''}</li>`).join('')}</ol>`
            : '';

        if (!rcaSummary && !playbookTitle && !nextStepsHtml && !triageHtml) return '';

        return `
            <hr />
            <h3>AI Suggested Resolution</h3>
            ${rcaSummary ? `<p><strong>RCA Summary:</strong> ${rcaSummary}</p>` : ''}
            ${nextStepsHtml ? `<p><strong>Next Steps:</strong></p>${nextStepsHtml}` : ''}
            ${playbookTitle ? `<p><strong>Playbook:</strong> ${playbookTitle}</p>` : ''}
            ${triageHtml ? `<p><strong>Triage Steps:</strong></p>${triageHtml}` : ''}
        `;
    } catch {
        return '';
    }
};

export const checkAndAlert = async (log: LogEntry) => {
    const db = getDb();
    const org = await getOrganizationWithDetails(log.organizationId);

    if (!org) return;

    const threshold = org.anomalyThreshold ?? 0.7;
    const score = log.anomalyScore ?? 0;

    const isFatal = log.level === LogLevel.FATAL;
    const isHighAnomaly = score >= threshold;

    if (!isFatal && !isHighAnomaly) return;

    const alertType: AlertType = isFatal ? 'fatal' : 'anomaly_high';
    const severity: 'CRITICAL' | 'HIGH' = isFatal ? 'CRITICAL' : 'HIGH';

    const canSend = await shouldSendAlert(org.id, alertType, log.source ?? null);
    const alertEventId = await createAlertEvent(org.id, alertType, severity, log.source ?? null, log.id ?? null, {
        log,
        threshold,
        score,
        suppressed: !canSend
    });

    if (!canSend) return;

    alertQueue.enqueue(`alert:${alertEventId}`, async () => {
        console.log(`🚨 Alert queued! Type: ${alertType}. Org: ${org.name}. Source: ${log.source}`);

        // 1. Send Telegram Alert (FATAL only) - Priority
        if (isFatal) {
            try {
                await sendTelegramFatalAlert(log);
            } catch (e: any) {
                console.error('[Telegram] Alert failed (non-critical):', e.message);
            }
        }

        const aiGuidanceHtml = await getAiGuidanceHtml(log);

        // 2. Send Email to Admins (ONLY FOR FATAL ERRORS)
        if (isFatal) {
            try {
                const admins = await db.all<User>(
                    'SELECT * FROM users WHERE "organizationId" = ? AND "role" IN (?, ?, ?, ?)',
                    [org.id, Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]
                );

                const subject = `🚨 FATAL ERROR Detected in ${log.source}`;
                const html = `
                    <h2>🚨 Fatal Error Detected</h2>
                    <p>A fatal error was detected in your system.</p>
                    <ul>
                        <li><strong>Anomaly Score:</strong> ${score.toFixed(3)}</li>
                        <li><strong>Source:</strong> ${log.source}</li>
                        <li><strong>Level:</strong> ${log.level}</li>
                        <li><strong>Timestamp:</strong> ${new Date(log.timestamp).toLocaleString()}</li>
                    </ul>
                    <p><strong>Message:</strong></p>
                    <pre style="background-color: #f0f0f0; padding: 10px; border-radius: 5px;">${log.message}</pre>
                    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/incidents" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Incident Center</a></p>
                    ${aiGuidanceHtml}
                `;

                for (const admin of admins) {
                    const email = admin.notificationEmail || admin.email;
                    await sendEmail({ to: email, subject, text: `FATAL Alert: ${log.message}`, html });
                }
            } catch (e: any) {
                console.error('[Email] Alert failed (non-critical):', e.message);
            }
        }

        // 3. Send Slack Alert
        if (org.slackWebhookUrl) {
            try {
                await sendSlackAlert(org.slackWebhookUrl, {
                    title: isFatal ? 'Fatal Error Detected' : 'High Anomaly Detected',
                    message: log.message,
                    severity: severity,
                    source: log.source
                });
            } catch (e: any) {
                console.error('[Slack] Alert failed (non-critical):', e.message);
            }
        }

        // 3.5 Send Teams Alert
        if (org.teamsWebhookUrl) {
            try {
                await sendTeamsAlert(org.teamsWebhookUrl, {
                    title: isFatal ? 'Fatal Error Detected' : 'High Anomaly Detected',
                    message: log.message,
                    severity: severity,
                    source: log.source
                });
            } catch (e: any) {
                console.error('[Teams] Alert failed (non-critical):', e.message);
            }
        }

        // 4. Send Generic Webhook
        if (org.webhookUrl) {
            await sendWebhook(org.webhookUrl, {
                event: isFatal ? 'fatal_detected' : 'anomaly_detected',
                log: log,
                threshold: threshold,
                timestamp: new Date().toISOString()
            });
        }

        // 5. Match and trigger Automated Remediations (Runbooks)
        const runbooks = await db.all<any>(
            'SELECT * FROM runbooks WHERE "organizationId" = ? AND "enabled" = true',
            [org.id]
        );
        
        for (const r of runbooks) {
            // In a real application, you might map specific alert types to specific runbooks
            // Here, we trigger all enabled runbooks for demonstration of ChatOps remediation
            runbookQueue.enqueue(`runbook:${r.id}:${log.id}`, async () => {
                const config = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
                if (r.triggerType === 'webhook' && config.url) {
                    await sendWebhook(config.url, {
                        runbookName: r.name,
                        triggerEvent: isFatal ? 'FATAL_ERROR' : 'HIGH_ANOMALY',
                        log: log
                    });
                }
            }, { maxAttempts: 3, initialDelayMs: 250, backoffFactor: 2 });
        }

        await markAlertSent(org.id, alertType, log.source ?? null);
    }, { maxAttempts: 3, initialDelayMs: 250, backoffFactor: 2 });
};
