import { getDb } from './database';
import { LogLevel, LogEntry, Organization } from './types';
import * as crypto from 'crypto';

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

const generateLogEntry = (): Omit<LogEntry, 'id' | 'organizationId' | 'timestamp'> => {
  let level: LogLevel;
  let anomalyScore: number;
  let message = getRandomElement(messages);
  
  const rand = Math.random();
  if (rand < 0.7) {
    level = LogLevel.INFO;
    anomalyScore = Math.random() * 0.1; // 0.0 - 0.1
  } else if (rand < 0.9) {
    level = LogLevel.WARN;
    anomalyScore = 0.2 + Math.random() * 0.3; // 0.2 - 0.5
  } else if (rand < 0.97) {
    level = LogLevel.ERROR;
    anomalyScore = 0.5 + Math.random() * 0.3; // 0.5 - 0.8
  } else {
    level = LogLevel.FATAL;
    anomalyScore = 0.8 + Math.random() * 0.2; // 0.8 - 1.0
    if (anomalyScore > 0.95) {
        message = messages[10]; // Ensure a very specific fatal message for high scores
    }
  }
  // Sprinkle in some debug logs
  if (Math.random() < 0.1) {
    level = LogLevel.DEBUG;
    anomalyScore = 0.1 + Math.random() * 0.1; // 0.1 - 0.2
  }

  return {
    level,
    source: getRandomElement(sources),
    message,
    anomalyScore,
  };
};

const insertLogForOrg = async (organizationId: string) => {
    const db = getDb();
    const logData = generateLogEntry();
    const newLog: LogEntry = {
        id: crypto.randomUUID(),
        organizationId,
        timestamp: new Date().toISOString(),
        ...logData,
    };
    
    try {
        await db.run(
            'INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore") VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newLog.id, newLog.organizationId, newLog.timestamp, newLog.level, newLog.message, newLog.source, newLog.anomalyScore]
        );
    } catch (error) {
        console.error(`Failed to insert log for org ${organizationId}:`, error);
    }
};

export const startLogGeneration = () => {
    console.log('Starting background log generation service...');
    
    // Generate a log for each organization every 3-5 seconds
    setInterval(async () => {
        const db = getDb();
        try {
            const orgs = await db.all<Organization>('SELECT "id" FROM organizations');
            for (const org of orgs) {
                // Introduce a slight random delay for each org to stagger inserts
                setTimeout(() => insertLogForOrg(org.id), Math.random() * 1000);
            }
        } catch (error) {
            console.error('Failed to fetch organizations for log generation:', error);
        }
    }, 3000);
};
