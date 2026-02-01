


import { Pool } from 'pg';
import * as crypto from 'crypto';
import { exit } from 'process';
import bcrypt from 'bcryptjs';
import { PlanDetails, Role, SubscriptionPlan, User, Organization } from './types';

const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
    Free: {
        name: 'Free',
        price: '$0 / month',
        quotas: { logsPerMonth: 10000, members: 3 },
        features: ['10,000 Log Events/Month', '3 Team Members', 'Basic Anomaly Detection', 'Community Support'],
    },
    Pro: {
        name: 'Pro',
        price: '$99 / month',
        quotas: { logsPerMonth: 100000, members: 10 },
        features: ['100,000 Log Events/Month', '10 Team Members', 'Advanced Anomaly Detection', 'Email & Chat Support'],
    },
    Enterprise: {
        name: 'Enterprise',
        price: 'Custom',
        quotas: { logsPerMonth: 1000000, members: Infinity },
        features: ['Unlimited Log Events', 'Unlimited Members', 'Dedicated Infrastructure', '24/7 Priority Support'],
    },
};

let pool: Pool;

// Helper to convert sqlite '?' placeholders to postgres '$1, $2, ...'
const transformSql = (sql: string) => {
    let i = 0;
    // This regex looks for '?' that are not inside single or double quotes
    return sql.replace(/(?<!['"])\?(?!['"])/g, () => `$${++i}`);
};


export const connectDb = async () => {
    if (pool) return;

    try {
        console.log('Connecting to PostgreSQL database...');
        const connectionConfig = process.env.DATABASE_URL
            ? { 
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false } // Required for Render/Cloud DBs
              }
            : {
                host: process.env.POSTGRES_HOST || 'localhost',
                port: parseInt(process.env.POSTGRES_PORT || '5434'),
                user: process.env.POSTGRES_USER || 'admin',
                password: process.env.POSTGRES_PASSWORD || 'password123',
                database: process.env.POSTGRES_DB || 'ailoganalyzer',
            };

        pool = new Pool(connectionConfig);

        // Test the connection
        await pool.query('SELECT NOW()');

    } catch (err) {
        console.error('Failed to connect to PostgreSQL. Please ensure the database is running and environment variables are set correctly.', err);
        exit(1);
    }
    
    const db = getDb();

    // Enable the TimescaleDB extension to use functions like time_bucket
    try {
        await db.exec('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
    } catch (e) {
        console.warn('TimescaleDB extension could not be enabled. Some features might be limited.', e);
    }

    // Use double quotes to preserve camelCase column names in PostgreSQL
    await db.exec(`
        CREATE TABLE IF NOT EXISTS organizations (
            "id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL UNIQUE,
            "plan" TEXT NOT NULL,
            "anomalyThreshold" REAL DEFAULT 0.7,
            "slackWebhookUrl" TEXT,
            "webhookUrl" TEXT
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "username" TEXT NOT NULL UNIQUE,
            "password" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "email" TEXT NOT NULL UNIQUE,
            "jobTitle" TEXT,
            "salary" REAL,
            "hireDate" TEXT,
            "notificationEmail" TEXT,
            "phone" TEXT,
            "isVerified" BOOLEAN DEFAULT FALSE,
            "verificationToken" TEXT,
            FOREIGN KEY ("organizationId") REFERENCES organizations("id")
        );
    `);
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "timestamp" TIMESTAMPTZ NOT NULL,
            "level" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "source" TEXT NOT NULL,
            "anomalyScore" REAL,
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS api_keys (
            "id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "keyHash" TEXT NOT NULL,
            "keyPrefix" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "lastUsed" TIMESTAMPTZ,
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS saved_searches (
            "id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "query" JSONB NOT NULL,
            "userId" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("userId") REFERENCES users("id") ON DELETE CASCADE,
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS connector_configs (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "connectorId" TEXT NOT NULL,
            "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
            "status" TEXT NOT NULL DEFAULT 'inactive',
            "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "lastSync" TIMESTAMPTZ,
            "lastError" TEXT,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE,
            UNIQUE ("organizationId", "connectorId")
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS alert_events (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "severity" TEXT NOT NULL,
            "source" TEXT,
            "logId" TEXT,
            "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS alert_cooldowns (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "source" TEXT,
            "lastSentAt" TIMESTAMPTZ NOT NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE,
            UNIQUE ("organizationId", "type", "source")
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS log_pipelines (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "enabled" BOOLEAN DEFAULT TRUE,
            "order" INTEGER DEFAULT 0,
            "rules" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS email_events (
            "id" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "event" TEXT NOT NULL, -- sent, delivered, bounce, complaint, click, open
            "reason" TEXT,
            "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS email_suppressions (
            "email" TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            "reason" TEXT NOT NULL, -- bounce, complaint, manually_unsubscribed, spam_trap
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY ("organizationId") REFERENCES organizations("id") ON DELETE CASCADE
        );
    `);
    // Add indexes for performance
    await db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users("username");');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users("email");');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_users_organizationId ON users("organizationId");');
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_logs_organizationId_timestamp ON logs("organizationId", "timestamp" DESC);');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_logs_level ON logs("level");');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_logs_source ON logs("source");');
    // Full-text search index for Log Explorer
    await db.exec(`
        ALTER TABLE logs ADD COLUMN IF NOT EXISTS "message_tsv" tsvector;
        CREATE INDEX IF NOT EXISTS idx_logs_message_tsv ON logs USING gin("message_tsv");
        CREATE OR REPLACE FUNCTION logs_tsvector_trigger() RETURNS trigger AS $$
        begin
          new."message_tsv" := to_tsvector('english', new.message);
          return new;
        end
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS tsvectorupdate ON logs;
        CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
        ON logs FOR EACH ROW EXECUTE PROCEDURE logs_tsvector_trigger();
    `);

    await db.exec('CREATE INDEX IF NOT EXISTS idx_api_keys_organizationId ON api_keys("organizationId");');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_saved_searches_organizationId ON saved_searches("organizationId");');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_connector_configs_org_connector ON connector_configs("organizationId", "connectorId");');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_alert_events_org_created ON alert_events("organizationId", "createdAt" DESC);');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_alert_cooldowns_org_type_source ON alert_cooldowns("organizationId", "type", "source");');

    const row = await db.get<{ count: string }>('SELECT COUNT(*) as count FROM users');
    if (row && parseInt(row.count, 10) === 0) {
        console.log('No users found, creating superadmin...');
        const orgId = crypto.randomUUID();
        const superAdminId = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash('superadmin', 10);

        await db.run(
            'INSERT INTO organizations ("id", "name", "plan") VALUES (?, ?, ?)',
            [orgId, 'SuperAdmin Org', JSON.stringify(PLAN_DETAILS.Enterprise)]
        );

        await db.run(
            `INSERT INTO users ("id", "organizationId", "username", "password", "role", "email", "jobTitle", "salary", "hireDate", "notificationEmail", "phone", "isVerified")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                superAdminId,
                orgId,
                'superadmin',
                hashedPassword,
                Role.SUPER_ADMIN,
                'superadmin@example.com',
                'Platform Overlord',
                999999,
                new Date('2023-01-15T09:00:00Z').toISOString(),
                'alerts-superadmin@example.com',
                null,
                true // Use boolean for PostgreSQL
            ]
        );
        console.log('Superadmin created.');
    }
};

export const getDb = () => {
    if (!pool) {
        throw new Error('Database not connected. Call connectDb first.');
    }
    // Return an object that mimics the sqlite db object's most used methods
    return {
        async get<T>(sql: string, params?: any[]): Promise<T | undefined> {
            const result = await pool.query(transformSql(sql), params);
            return result.rows[0];
        },
        async all<T>(sql: string, params?: any[]): Promise<T[]> {
            const result = await pool.query(transformSql(sql), params);
            return result.rows;
        },
        async run(sql: string, params?: any[]): Promise<{ changes: number | null }> {
            const result = await pool.query(transformSql(sql), params);
            return { changes: result.rowCount };
        },
        async exec(sql: string): Promise<void> {
            await pool.query(sql);
        }
    };
};

export const getOrganizationWithDetails = async (orgId: string): Promise<Organization | null> => {
    const db = getDb();
    const row = await db.get<{id: string; name: string; plan: string; anomalyThreshold: number; slackWebhookUrl: string; webhookUrl: string;}>('SELECT * FROM organizations WHERE "id" = ?', [orgId]);
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        plan: JSON.parse(row.plan),
        anomalyThreshold: row.anomalyThreshold,
        slackWebhookUrl: row.slackWebhookUrl,
        webhookUrl: row.webhookUrl
    };
}

export const PLAN_CONFIG = PLAN_DETAILS;