import { AuditLogAction, AuditLogEntry, User } from "../types";

const AUDIT_LOGS_KEY = 'saas_app_audit_logs';

const initializeLogs = () => {
    if (!localStorage.getItem(AUDIT_LOGS_KEY)) {
        localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify([]));
    }
}
initializeLogs();

export const getAuditLogs = (): Promise<AuditLogEntry[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const logs = JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY) || '[]');
            resolve(logs.sort((a: AuditLogEntry, b: AuditLogEntry) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        }, 300); // Simulate network delay
    });
};

export const createAuditLog = (
    actor: User,
    action: AuditLogAction,
    details: Record<string, any>
): void => {
    try {
        const logs: AuditLogEntry[] = JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY) || '[]');
        
        const newLog: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            userId: actor.id,
            username: actor.username,
            action: action,
            details: details,
        };

        const updatedLogs = [newLog, ...logs];
        // Keep the list from growing indefinitely to avoid performance issues with localStorage
        if (updatedLogs.length > 500) {
            updatedLogs.length = 500;
        }

        localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(updatedLogs));
    } catch (error) {
        console.error("Failed to create audit log:", error);
    }
};
