
import { LogEntry, Anomaly, LogSummary, AlertHistoryEntry, AlertRule, NotificationContact, Role, LogFilter, LogLevel } from '../types';
import { handleResponse } from './authService';

const API_BASE_URL = '/api';

// This is now the single source of truth for available sources, fetched from the backend.
// For now, we keep it hardcoded to avoid another API call, but in a real app this could be dynamic.
export const sources = ['api-gateway', 'user-service', 'db-replicator', 'frontend-logger', 'auth-service'];

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getAnomalies = async (threshold: number): Promise<Anomaly[]> => {
    const response = await fetch(`${API_BASE_URL}/logs/anomalies?threshold=${threshold}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getLogSummary = async (): Promise<LogSummary[]> => {
    const response = await fetch(`${API_BASE_URL}/logs/summary`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getHistoricalLogs = async (count = 200): Promise<LogEntry[]> => {
    const response = await fetch(`${API_BASE_URL}/logs/history?limit=${count}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getLiveLogs = async (since: string | null, limit: number = 50): Promise<LogEntry[]> => {
    let url = `${API_BASE_URL}/logs?limit=${limit}`;
    if (since) {
        url += `&since=${since}`;
    }
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const exploreLogs = async (filters: { query?: string, startDate?: string, endDate?: string, levels?: string[], sources?: string[], page?: number, limit?: number, facetFilters?: LogFilter[] }): Promise<{ logs: LogEntry[], pagination: any }> => {
    const params = new URLSearchParams();
    if (filters.query) params.append('query', filters.query);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.levels && filters.levels.length > 0) params.append('levels', filters.levels.join(','));
    if (filters.sources && filters.sources.length > 0) params.append('sources', filters.sources.join(','));
    if (filters.facetFilters && filters.facetFilters.length > 0) {
        params.append('facetFilters', JSON.stringify(filters.facetFilters));
    }

    const response = await fetch(`${API_BASE_URL}/logs/explore?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getLogHistogram = async (filters: { query?: string, startDate?: string, endDate?: string, levels?: string[], sources?: string[] }): Promise<{ time: string, count: number }[]> => {
    const params = new URLSearchParams();
    if (filters.query) params.append('query', filters.query);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.levels && filters.levels.length > 0) params.append('levels', filters.levels.join(','));
    if (filters.sources && filters.sources.length > 0) params.append('sources', filters.sources.join(','));

    const response = await fetch(`${API_BASE_URL}/logs/histogram?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const bulkIngestLogs = async (logs: Partial<LogEntry>[]): Promise<{ count: number }> => {
    const response = await fetch(`${API_BASE_URL}/logs/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};


export const getAlertHistory = (): Promise<AlertHistoryEntry[]> => {
    const response = fetch(`${API_BASE_URL}/alerts/history`, {
        headers: getAuthHeaders(),
    });
    return response.then(handleResponse);
};

export const getAlertEvents = (params: { type?: string; severity?: string; sent?: string; limit?: number } = {}): Promise<any[]> => {
    const qs = new URLSearchParams();
    if (params.type) qs.append('type', params.type);
    if (params.severity) qs.append('severity', params.severity);
    if (params.sent) qs.append('sent', params.sent);
    if (params.limit) qs.append('limit', String(params.limit));

    const response = fetch(`${API_BASE_URL}/alerts/events?${qs.toString()}`, {
        headers: getAuthHeaders(),
    });
    return response.then(handleResponse);
};

export const generateAlertProposal = (alertId: string): Promise<any> => {
    const response = fetch(`${API_BASE_URL}/alerts/events/${encodeURIComponent(alertId)}/proposal`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return response.then(handleResponse);
};

export const logAlertToHistory = (log: LogEntry): void => {
    void log;
};


// --- CRUD for Alert Rules (Mocked with LocalStorage) ---
const ALERT_RULES_KEY = 'alertRules';

const initializeAlertRules = () => {
    if (!localStorage.getItem(ALERT_RULES_KEY)) {
        const defaultRules: AlertRule[] = [
            { 
                id: 'rule1', 
                name: 'DB Connection Failure', 
                condition: { type: 'keyword', keyword: 'Failed to connect to database', level: LogLevel.ERROR }, 
                channel: 'sms', 
                enabled: true 
            },
            { 
                id: 'rule2', 
                name: 'High Volume of Auth Errors', 
                condition: { type: 'threshold', source: 'auth-service', level: LogLevel.ERROR, count: 5, timeWindowMinutes: 1 }, 
                channel: 'email', 
                enabled: true 
            },
        ];
        localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(defaultRules));
    }
};
initializeAlertRules();

export const getAlertRules = (): Promise<AlertRule[]> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const rules = JSON.parse(localStorage.getItem(ALERT_RULES_KEY) || '[]');
                resolve(rules);
            } catch (error) {
                console.error("Failed to fetch alert rules:", error);
                reject(error);
            }
        }, 200);
    });
};

export const createAlertRule = (ruleData: Omit<AlertRule, 'id'>): Promise<AlertRule> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const rules = JSON.parse(localStorage.getItem(ALERT_RULES_KEY) || '[]');
                const newRule: AlertRule = { ...ruleData, id: crypto.randomUUID() };
                rules.push(newRule);
                localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(rules));
                resolve(newRule);
            } catch (error) {
                console.error("Failed to create alert rule:", error);
                reject(error);
            }
        }, 200);
    });
};

export const updateAlertRule = (ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const rules: AlertRule[] = JSON.parse(localStorage.getItem(ALERT_RULES_KEY) || '[]');
                const index = rules.findIndex(r => r.id === ruleId);
                if (index === -1) {
                    return reject(new Error('Rule not found'));
                }
                rules[index] = { ...rules[index], ...updates };
                localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(rules));
                resolve(rules[index]);
            } catch (error) {
                console.error("Failed to update alert rule:", error);
                reject(error);
            }
        }, 200);
    });
};

export const deleteAlertRule = (ruleId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                let rules: AlertRule[] = JSON.parse(localStorage.getItem(ALERT_RULES_KEY) || '[]');
                rules = rules.filter(r => r.id !== ruleId);
                localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(rules));
                resolve();
            } catch (error) {
                console.error("Failed to delete alert rule:", error);
                reject(error);
            }
        }, 200);
    });
};


export const getNotificationContacts = (): Promise<NotificationContact[]> => {
    return new Promise((resolve, reject) => {
        // In a real app, this would come from a user's settings or an API.
        // For this mock, we'll return a static list of contacts.
        setTimeout(() => {
            try {
                const contacts: NotificationContact[] = [
                    { id: 'user-1', name: 'Admin User', phone: '+15551234567', role: Role.ADMIN },
                    { id: 'user-2', name: 'On-Call Analyst', phone: '+15557654321', role: Role.ANALYST },
                ];
                resolve(contacts);
            } catch (error) {
                console.error("Failed to fetch notification contacts:", error);
                reject(error);
            }
        }, 200);
    });
};
