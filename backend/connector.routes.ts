import express from 'express';
import { getDb } from './database';
import { protect } from './auth.routes';
import * as crypto from 'crypto';

const router = express.Router();

type ConnectorId = 'aws' | 'azure' | 'gcp' | 'slack' | 'datadog';
type ConnectorStatus = 'active' | 'inactive' | 'error';

type ConnectorRow = {
    id: string;
    organizationId: string;
    connectorId: ConnectorId;
    enabled: boolean;
    status: ConnectorStatus;
    config: any;
    lastSync: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
};

const CONNECTORS: Array<{ id: ConnectorId; name: string; icon: string; description: string }> = [
    {
        id: 'aws',
        name: 'AWS CloudWatch',
        icon: 'cloud',
        description: 'Stream logs from AWS Lambda, EC2, and RDS.'
    },
    {
        id: 'azure',
        name: 'Azure Monitor',
        icon: 'cloud',
        description: 'Connect Azure App Services and Functions.'
    },
    {
        id: 'gcp',
        name: 'Google Cloud Logging',
        icon: 'cloud',
        description: 'Ingest logs from GKE and Cloud Functions.'
    },
    {
        id: 'slack',
        name: 'Slack Alerts',
        icon: 'message-circle',
        description: 'Send critical alerts to a Slack channel.'
    },
    {
        id: 'datadog',
        name: 'Datadog',
        icon: 'activity',
        description: 'Sync metrics and logs with Datadog.'
    }
];

const SECRET_FIELDS_BY_CONNECTOR: Record<ConnectorId, string[]> = {
    aws: ['secretAccessKey'],
    azure: ['clientSecret', 'connectionString', 'apiKey'],
    gcp: ['serviceAccountJson', 'apiKey'],
    slack: ['webhookUrl'],
    datadog: ['apiKey', 'appKey']
};

const maskSecret = (value: unknown) => {
    if (typeof value !== 'string') return value;
    if (!value) return value;
    if (value.length <= 6) return '******';
    return `${value.slice(0, 2)}******${value.slice(-2)}`;
};

const redactConfig = (connectorId: ConnectorId, config: any) => {
    const redacted = { ...(config || {}) };
    for (const field of SECRET_FIELDS_BY_CONNECTOR[connectorId] || []) {
        if (redacted[field]) {
            redacted[field] = maskSecret(redacted[field]);
        }
    }
    return redacted;
};

const mergeConfigPreservingSecrets = (connectorId: ConnectorId, existingConfig: any, incomingConfig: any) => {
    const merged: any = { ...(existingConfig || {}) };
    const secrets = new Set(SECRET_FIELDS_BY_CONNECTOR[connectorId] || []);

    for (const [key, value] of Object.entries(incomingConfig || {})) {
        if (secrets.has(key)) {
            if (typeof value === 'string' && value.trim() === '') {
                continue;
            }
            if (typeof value === 'string' && value.includes('******')) {
                continue;
            }
        }
        merged[key] = value;
    }

    return merged;
};

const validateConfig = (connectorId: ConnectorId, config: any) => {
    if (!config || typeof config !== 'object') {
        return { ok: false, message: 'Invalid configuration payload.' };
    }

    if (connectorId === 'aws') {
        if (!config.accessKeyId || typeof config.accessKeyId !== 'string') {
            return { ok: false, message: 'AWS Access Key ID is required.' };
        }
        if (config.secretAccessKey !== undefined && typeof config.secretAccessKey !== 'string') {
            return { ok: false, message: 'AWS Secret Access Key must be a string.' };
        }
        if (!config.region || typeof config.region !== 'string') {
            return { ok: false, message: 'AWS Region is required.' };
        }
    }

    if (connectorId === 'slack') {
        if (!config.webhookUrl || typeof config.webhookUrl !== 'string') {
            return { ok: false, message: 'Slack Webhook URL is required.' };
        }
        if (!config.webhookUrl.startsWith('https://hooks.slack.com')) {
            return { ok: false, message: 'Invalid Slack Webhook URL.' };
        }
    }

    return { ok: true };
};

const getAuthOrgId = (req: express.Request) => {
    const user = (req as any).user;
    return user?.organizationId as string | undefined;
};

const assertConnectorId = (id: string): id is ConnectorId => {
    return (CONNECTORS as any).some((c: any) => c.id === id);
};

const getConnectorRow = async (organizationId: string, connectorId: ConnectorId): Promise<ConnectorRow | undefined> => {
    const db = getDb();
    return db.get<ConnectorRow>(
        'SELECT * FROM connector_configs WHERE "organizationId" = ? AND "connectorId" = ?',
        [organizationId, connectorId]
    );
};

const upsertConnectorRow = async (organizationId: string, connectorId: ConnectorId, updates: Partial<ConnectorRow>) => {
    const db = getDb();
    const existing = await getConnectorRow(organizationId, connectorId);

    if (!existing) {
        const id = crypto.randomUUID();
        await db.run(
            `INSERT INTO connector_configs ("id", "organizationId", "connectorId", "enabled", "status", "config", "lastSync", "lastError", "createdAt", "updatedAt")
             VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, NOW(), NOW())`,
            [
                id,
                organizationId,
                connectorId,
                updates.enabled ?? false,
                updates.status ?? 'inactive',
                JSON.stringify(updates.config ?? {}),
                updates.lastSync ?? null,
                updates.lastError ?? null
            ]
        );
    } else {
        const newEnabled = updates.enabled ?? existing.enabled;
        const newStatus = updates.status ?? existing.status;
        const newConfig = updates.config ?? existing.config;
        const newLastSync = updates.lastSync ?? existing.lastSync;
        const newLastError = updates.lastError ?? existing.lastError;

        await db.run(
            `UPDATE connector_configs
             SET "enabled" = ?, "status" = ?, "config" = ?::jsonb, "lastSync" = ?, "lastError" = ?, "updatedAt" = NOW()
             WHERE "organizationId" = ? AND "connectorId" = ?`,
            [
                newEnabled,
                newStatus,
                JSON.stringify(newConfig),
                newLastSync,
                newLastError,
                organizationId,
                connectorId
            ]
        );
    }

    return getConnectorRow(organizationId, connectorId);
};

// GET /api/connectors
// List all available connectors and their status
router.get('/', protect, async (req, res) => {
    const organizationId = getAuthOrgId(req);
    if (!organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = getDb();
    const rows = await db.all<ConnectorRow>('SELECT * FROM connector_configs WHERE "organizationId" = ?', [organizationId]);
    const rowById = new Map<string, ConnectorRow>();
    for (const row of rows) {
        rowById.set(row.connectorId, row);
    }

    const connectors = CONNECTORS.map(c => {
        const row = rowById.get(c.id);
        const status: ConnectorStatus = row?.enabled ? (row?.status || 'active') : 'inactive';
        return {
            id: c.id,
            name: c.name,
            icon: c.icon,
            description: c.description,
            status,
            lastSync: row?.lastSync || null,
            lastError: row?.lastError || null
        };
    });

    res.json(connectors);
});

// GET /api/connectors/:id/config
// Fetch saved configuration for a connector (secrets are masked)
router.get('/:id/config', protect, async (req, res) => {
    const organizationId = getAuthOrgId(req);
    if (!organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!assertConnectorId(id)) {
        return res.status(404).json({ message: 'Unknown connector.' });
    }

    const row = await getConnectorRow(organizationId, id);
    if (!row) {
        return res.json({ enabled: false, status: 'inactive', lastSync: null, lastError: null, config: {} });
    }

    return res.json({
        enabled: row.enabled,
        status: row.status,
        lastSync: row.lastSync || null,
        lastError: row.lastError || null,
        config: redactConfig(id, row.config)
    });
});

// POST /api/connectors/:id/config
// Save configuration for a connector
router.post('/:id/config', protect, async (req, res) => {
    const organizationId = getAuthOrgId(req);
    if (!organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!assertConnectorId(id)) {
        return res.status(404).json({ message: 'Unknown connector.' });
    }

    const config = req.body;
    const validation = validateConfig(id, config);
    if (!validation.ok) {
        return res.status(400).json({ message: validation.message });
    }

    const existing = await getConnectorRow(organizationId, id);
    const mergedConfig = mergeConfigPreservingSecrets(id, existing?.config, config);

    const saved = await upsertConnectorRow(organizationId, id, {
        enabled: true,
        status: 'active',
        config: mergedConfig,
        lastError: null
    });

    res.json({
        message: 'Configuration saved successfully.',
        connector: {
            id,
            enabled: saved?.enabled ?? true,
            status: saved?.status ?? 'active',
            lastSync: saved?.lastSync || null,
            lastError: saved?.lastError || null,
            config: redactConfig(id, saved?.config)
        }
    });
});

// POST /api/connectors/:id/test
// Test the connection to the external service
router.post('/:id/test', protect, async (req, res) => {
    const organizationId = getAuthOrgId(req);
    if (!organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!assertConnectorId(id)) {
        return res.status(404).json({ message: 'Unknown connector.' });
    }

    const config = req.body;
    const validation = validateConfig(id, config);
    if (!validation.ok) {
        await upsertConnectorRow(organizationId, id, {
            enabled: true,
            status: 'error',
            lastError: validation.message || 'Validation failed.'
        });
        return res.status(400).json({ message: validation.message });
    }

    // Simulate connection testing
    await new Promise(resolve => setTimeout(resolve, 800));

    await upsertConnectorRow(organizationId, id, {
        enabled: true,
        status: 'active',
        lastError: null,
        lastSync: new Date().toISOString()
    });

    res.json({
        success: true,
        message: `Successfully connected to ${id.toUpperCase()}!`,
        latency: Math.floor(Math.random() * 100) + 20 + 'ms'
    });
});

// POST /api/connectors/:id/toggle
// Enable or disable a connector
router.post('/:id/toggle', protect, async (req, res) => {
    const organizationId = getAuthOrgId(req);
    if (!organizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!assertConnectorId(id)) {
        return res.status(404).json({ message: 'Unknown connector.' });
    }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled must be a boolean.' });
    }

    const existing = await getConnectorRow(organizationId, id);
    const status: ConnectorStatus = enabled ? (existing?.status || 'active') : 'inactive';

    await upsertConnectorRow(organizationId, id, {
        enabled,
        status,
        lastError: enabled ? existing?.lastError ?? null : null
    });

    res.json({ message: `Connector ${enabled ? 'enabled' : 'disabled'}.`, status });
});

export default router;
