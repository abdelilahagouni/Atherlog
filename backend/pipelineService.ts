// pipelineService.ts - Business logic for log processing pipelines and PII masking
import { getDb } from './database';
import { LogEntry } from './types';

export interface PipelineRule {
    type: 'mask' | 'filter' | 'enrich' | 'parse';
    config: any;
}

export interface LogPipeline {
    id: string;
    organizationId: string;
    name: string;
    rules: PipelineRule[];
    enabled: boolean;
}

// Common PII Patterns
const PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    phone: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
};

/**
 * Mask PII in a string using regex
 */
export const maskPII = (text: string, patterns: string[] = ['email', 'creditCard', 'ssn']): string => {
    let maskedText = text;
    
    patterns.forEach(type => {
        // Normalize pattern name (e.g., 'credit_card' -> 'creditCard')
        const normalizedType = type.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const pattern = PII_PATTERNS[normalizedType as keyof typeof PII_PATTERNS];
        if (pattern) {
            maskedText = maskedText.replace(pattern, (match) => {
                if (normalizedType === 'email') {
                    const [user, domain] = match.split('@');
                    return `${user[0]}***@${domain}`;
                }
                return '****-****-****-' + match.slice(-4);
            });
        }
    });

    return maskedText;
};

/**
 * Process a log entry through all active pipelines for an organization
 */
export const processLogThroughPipelines = async (log: Omit<LogEntry, 'id' | 'timestamp'>, organizationId: string): Promise<Omit<LogEntry, 'id' | 'timestamp'> | null> => {
    const db = getDb();
    
    try {
        // Fetch active pipelines for the organization
        const pipelines = await db.all<LogPipeline>(
            'SELECT * FROM log_pipelines WHERE "organizationId" = ? AND "enabled" = TRUE ORDER BY "order" ASC',
            [organizationId]
        );

        if (!pipelines || pipelines.length === 0) {
            // Apply default PII masking even if no pipeline is defined (Security Best Practice)
            log.message = maskPII(log.message);
            return log;
        }

        let processedLog = { ...log };

        for (const pipeline of pipelines) {
            // Ensure rules is parsed if it's a string (Postgres might return it as string depending on driver)
            const rules = typeof pipeline.rules === 'string' ? JSON.parse(pipeline.rules) : pipeline.rules;

            for (const rule of rules) {
                switch (rule.type) {
                    case 'mask':
                        processedLog.message = maskPII(processedLog.message, rule.config?.patterns);
                        break;
                    
                    case 'filter':
                        // If filter rule returns true, the log should be dropped
                        if (rule.config?.condition) {
                           // Simple expression evaluation (in production, use a safer sandbox)
                           try {
                               const condition = new Function('log', `return ${rule.config.condition}`);
                               if (condition(processedLog)) return null;
                           } catch (e) {
                               console.error('Failed to evaluate pipeline filter:', e);
                           }
                        }
                        break;

                    case 'enrich':
                        if (rule.config?.tags) {
                            // Logic to add tags or metadata (assuming LogEntry supports it)
                            // processedLog.metadata = { ...processedLog.metadata, ...rule.config.tags };
                        }
                        break;
                }
            }
        }

        return processedLog;

    } catch (error) {
        console.error('Error processing log through pipelines:', error);
        // Fallback to basic masking if anything fails to ensure data safety
        log.message = maskPII(log.message);
        return log;
    }
};

/**
 * Create a default pipeline for new organizations
 */
export const createDefaultPipeline = async (organizationId: string): Promise<void> => {
    const db = getDb();
    const id = crypto.randomUUID();
    
    const defaultRules = [
        {
            type: 'mask',
            config: {
                patterns: ['email', 'creditCard', 'ssn']
            }
        }
    ];

    await db.run(
        'INSERT INTO log_pipelines ("id", "organizationId", "name", "description", "rules", "order") VALUES (?, ?, ?, ?, ?, ?)',
        [id, organizationId, 'Default Security Pipeline', 'Automatically masks PII (Emails, Credit Cards, SSNs)', JSON.stringify(defaultRules), 0]
    );
};
