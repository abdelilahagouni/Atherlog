// logRetentionService.ts - Automatic log cleanup to prevent database bloat
import { getDb } from './database';

const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '30');
const CLEANUP_INTERVAL_HOURS = parseInt(process.env.LOG_CLEANUP_INTERVAL_HOURS || '24');

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Delete logs older than the retention period
 */
export const cleanupOldLogs = async (): Promise<{ deleted: number }> => {
    const db = getDb();
    
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
        
        const result = await db.run(
            `DELETE FROM logs WHERE "timestamp" < ?`,
            [cutoffDate.toISOString()]
        );
        
        const deletedCount = result.changes || 0;
        
        if (deletedCount > 0) {
            console.log(`[Log Retention] Cleaned up ${deletedCount} logs older than ${LOG_RETENTION_DAYS} days.`);
        }
        
        return { deleted: deletedCount };
    } catch (error) {
        console.error('[Log Retention] Cleanup failed:', error);
        return { deleted: 0 };
    }
};

/**
 * Start the periodic log cleanup job
 */
export const startLogRetention = (): void => {
    if (cleanupInterval) {
        console.warn('[Log Retention] Already running.');
        return;
    }
    
    console.log(`[Log Retention] Started. Retention: ${LOG_RETENTION_DAYS} days, Cleanup interval: ${CLEANUP_INTERVAL_HOURS}h`);
    
    // Run immediately on startup
    cleanupOldLogs();
    
    // Schedule periodic cleanup
    cleanupInterval = setInterval(
        cleanupOldLogs,
        CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000
    );
};

/**
 * Stop the log cleanup job (for graceful shutdown)
 */
export const stopLogRetention = (): void => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('[Log Retention] Stopped.');
    }
};
