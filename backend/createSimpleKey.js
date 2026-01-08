const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const pool = new Pool({
    connectionString: 'postgres://admin:password123@localhost:5435/ailoganalyzer'
});

async function run() {
    try {
        const org = await pool.query('SELECT id FROM organizations LIMIT 1');
        if (org.rows.length === 0) {
            console.error('No organization found in database.');
            return;
        }
        const orgId = org.rows[0].id;
        const rawKey = 'AETHER_1234567890'; // 17 chars
        const keyHash = await bcrypt.hash(rawKey, 10);
        const keyPrefix = rawKey.substring(0, 8); // AETHER_1
        
        await pool.query(
            'INSERT INTO api_keys (id, name, "keyHash", "keyPrefix", "organizationId") VALUES ($1, $2, $3, $4, $5)',
            [crypto.randomUUID(), 'Simple Test Key', keyHash, keyPrefix, orgId]
        );
        
        console.log('API_KEY=' + rawKey);
    } catch (e) {
        console.error('Error creating test API key:', e);
    }
}

run().finally(() => pool.end());
