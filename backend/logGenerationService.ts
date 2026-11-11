import { getDb } from './database';
import { LogLevel, LogEntry, Organization } from './types';
import * as crypto from 'crypto';
import { emitLog } from './websocket';

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

// Messages that should always be FATAL level
const fatalMessages = [
  'FATAL: Core system meltdown imminent. Evacuate datacenter.',
  'FATAL: Database corruption detected. Immediate attention required.',
  'FATAL: Out of memory - system crash imminent.',
];

const normalMessages = [
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
];

// Demo log generator (only runs when DISABLE_DEMO_LOGS=false is set explicitly).
// Demo logs are clearly demo data: the level and message are picked at random, but they are NEVER given a made-up
// anomaly score - they are stored as "not scored" (anomalyScore = null, threatCategory = 'Not scored (demo)').
const generateLogEntry = (): Omit<LogEntry, 'id' | 'organizationId' | 'timestamp'> => {
  let level: LogLevel;
  let message: string;

  const rand = Math.random();
  if (rand < 0.7) {
    level = LogLevel.INFO;
    message = getRandomElement(normalMessages);
  } else if (rand < 0.9) {
    level = LogLevel.WARN;
    message = getRandomElement(normalMessages);
  } else if (rand < 0.97) {
    level = LogLevel.ERROR;
    message = getRandomElement(normalMessages);
  } else {
    level = LogLevel.FATAL;
    message = getRandomElement(fatalMessages);
  }
  if (Math.random() < 0.1 && level !== LogLevel.FATAL) {
    level = LogLevel.DEBUG;
  }

  return {
    level,
    source: getRandomElement(sources),
    message,
    anomalyScore: null,
    threatCategory: 'Not scored (demo)',
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
            'INSERT INTO logs ("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore", "threatCategory", "scoreStage") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newLog.id, newLog.organizationId, newLog.timestamp, newLog.level, newLog.message, newLog.source, null, 'Not scored (demo)', 'demo_unscored']
        );

        // Emit to WebSocket for Live Tail
        emitLog(newLog);

        const { checkAndAlert } = require('./alertingService');
        checkAndAlert(newLog).catch((e: any) => console.error('Alerting check failed:', e));
    } catch (error) {
        console.error(`Failed to insert log for org ${organizationId}:`, error);
    }
};

export const startLogGeneration = () => {
    // Second safety check: never generate demo logs unless DISABLE_DEMO_LOGS=false is set explicitly.
    if (process.env.DISABLE_DEMO_LOGS !== 'false') {
        console.log('Demo log generation refused: set DISABLE_DEMO_LOGS=false explicitly to enable it.');
        return;
    }
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
