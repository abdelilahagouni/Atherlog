import { LogEntry, Anomaly, LogSummary, LogLevel, Role, AlertRule, NotificationContact, AlertHistoryEntry } from '../types';

const sources = ['api-gateway', 'user-service', 'db-replicator', 'frontend-logger', 'auth-service'];
const messages = [
  'User logged in successfully',
  'Failed to connect to database: timeout expired',
  'Request processed in 25ms',
  'Invalid credentials for user: admin',
  'Cache cleared for key: user:123',
  'Unhandled exception: NullPointerException in UserProfile',
  'Service started on port 8080',
  'High CPU usage detected: 95%',
  'Disk space is critically low on /var/log',
  'Payment processed for order #ABC-123',
  'FATAL: Core system meltdown imminent. Evacuate datacenter.',
];

const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

let mockLogs: LogEntry[] = [];

// Pre-populate some logs
for (let i = 0; i < 200; i++) {
    const rand = Math.random();
    let level: LogLevel;
    let anomalyScore: number;

    if (rand < 0.7) {
        level = LogLevel.INFO;
        anomalyScore = Math.random() * 0.1;
    } else if (rand < 0.9) {
        level = LogLevel.WARN;
        anomalyScore = 0.2 + Math.random() * 0.3;
    } else {
        level = LogLevel.ERROR;
        anomalyScore = 0.5 + Math.random() * 0.4;
    }
    
    mockLogs.push({
        id: crypto.randomUUID(),
        organizationId: 'mock-org-id',
        timestamp: new Date(Date.now() - i * 30000).toISOString(),
        level,
        message: getRandomElement(messages),
        source: getRandomElement(sources),
        anomalyScore,
    });
}
mockLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());


export const getAnomalies = (threshold: number): Promise<Anomaly[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const anomalies = mockLogs
                .filter(log => (log.anomalyScore ?? 0) >= threshold)
                .map(log => ({ ...log, anomalyScore: log.anomalyScore! }));
            resolve(anomalies.slice(-50)); // Return last 50
        }, 300);
    });
};

export const getLogSummary = (): Promise<LogSummary[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const summary: LogSummary[] = [];
            const now = new Date();
            for (let i = 23; i >= 0; i--) {
                const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
                const hourString = `${hour.getHours().toString().padStart(2, '0')}:00`;
                summary.push({
                    hour: hourString,
                    total: Math.floor(Math.random() * 100),
                    anomalies: Math.floor(Math.random() * 10),
                    errors: Math.floor(Math.random() * 5),
                    fatals: Math.floor(Math.random() * 2),
                });
            }
            resolve(summary);
        }, 300);
    });
};

export const getHistoricalLogs = (count = 200): Promise<LogEntry[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(mockLogs.slice(-count));
        }, 300);
    });
};

let lastPolledIndex = mockLogs.length - 10;
export const getLiveLogs = (since?: string | null, limit: number = 5): Promise<LogEntry[]> => {
     return new Promise(resolve => {
        setTimeout(() => {
            const newLogs: LogEntry[] = [];
            const newIndex = lastPolledIndex + Math.floor(Math.random() * 3);
            if(newIndex > lastPolledIndex && newIndex < mockLogs.length) {
                newLogs.push(...mockLogs.slice(lastPolledIndex, newIndex));
                lastPolledIndex = newIndex;
            }
            resolve(newLogs);
        }, 500);
    });
}

export const getAlertHistory = (): Promise<AlertHistoryEntry[]> => {
    return new Promise(resolve => {
        const fatalLogs = mockLogs.filter(l => l.level === LogLevel.FATAL).slice(-20);
        const history: AlertHistoryEntry[] = fatalLogs.map(log => ({
            id: crypto.randomUUID(),
            timestamp: log.timestamp,
            log,
        }));
        resolve(history);
    });
}

export const getNotificationContacts = (): Promise<NotificationContact[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const contacts: NotificationContact[] = [
                { id: 'user-1', name: 'Admin User', phone: '+15551234567', role: Role.ADMIN },
                { id: 'user-2', name: 'On-Call Analyst', phone: '+15557654321', role: Role.ANALYST },
            ];
            resolve(contacts);
        }, 200);
    });
};
