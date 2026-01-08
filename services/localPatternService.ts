import { LogEntry, LogLevel, LogPattern } from '../types';

export const findLocalPatterns = (logs: LogEntry[]): LogPattern[] => {
    const patterns: LogPattern[] = [];

    // Pattern 1: Frequent Identical Errors
    const errorCounts: Record<string, { count: number, ids: string[] }> = {};
    logs.filter(log => log.level === LogLevel.ERROR).forEach(log => {
        if (!errorCounts[log.message]) {
            errorCounts[log.message] = { count: 0, ids: [] };
        }
        errorCounts[log.message].count++;
        errorCounts[log.message].ids.push(log.id);
    });

    for (const message in errorCounts) {
        if (errorCounts[message].count >= 3) {
            patterns.push({
                id: crypto.randomUUID(),
                title: 'Frequent Identical Error',
                type: 'Behavioral',
                description: `The error message "${message}" occurred ${errorCounts[message].count} times, suggesting a recurring problem.`,
                exampleLogIds: errorCounts[message].ids.slice(0, 5),
            });
        }
    }
    
    // Pattern 2: Authentication Failures
    const authFailures = logs.filter(log => log.source === 'auth-service' && log.message.toLowerCase().includes('invalid credentials'));
    if (authFailures.length >= 5) {
         patterns.push({
            id: crypto.randomUUID(),
            title: 'Repeated Authentication Failures',
            type: 'Behavioral',
            description: `Detected ${authFailures.length} failed login attempts. This could indicate a user struggling to log in or a potential brute-force attempt.`,
            exampleLogIds: authFailures.map(l => l.id).slice(0, 5),
        });
    }

    // Pattern 3: High CPU Warning Spike
    const highCpuWarnings = logs.filter(log => log.level === LogLevel.WARN && log.message.toLowerCase().includes('high cpu usage'));
    if (highCpuWarnings.length >= 3) {
        patterns.push({
            id: crypto.randomUUID(),
            title: 'High CPU Usage Spike',
            type: 'Temporal',
            description: `A cluster of ${highCpuWarnings.length} high CPU usage warnings was detected, indicating a potential performance bottleneck or resource exhaustion.`,
            exampleLogIds: highCpuWarnings.map(l => l.id).slice(0, 5),
        });
    }

    return patterns;
};
