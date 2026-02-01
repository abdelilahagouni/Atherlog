
const { Pool } = require('pg');
const axios = require('axios');
const bcrypt = require('bcryptjs');

// Connect to DB to get a valid key
const pool = new Pool({
    connectionString: "postgresql://admin:password123@localhost:5435/ailoganalyzer"
});

async function sendTestLog() {
    try {
        console.log('🔍 Finding a valid API Key...');
        
        // Let's cheat and insert a known temporary key for testing
        const tempKey = 'test-key-' + Date.now();
        const hash = await bcrypt.hash(tempKey, 10);
        
        // Get org id
        const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
        if (orgRes.rows.length === 0) {
            console.log('No organization found. Please run backend once.');
            return;
        }
        const orgId = orgRes.rows[0].id;

        await pool.query(
            'INSERT INTO api_keys (id, name, "keyHash", "keyPrefix", "organizationId") VALUES ($1, $2, $3, $4, $5)',
            ['temp-'+Date.now(), 'Temp Test Key', hash, tempKey.substring(0,8), orgId]
        );

        console.log('✅ Temporary API Key Created.');

        console.log('🚀 Sending Test Log...');
        
        await axios.post('http://localhost:4000/api/ingest', {
            level: 'ERROR',
            source: 'terminal-test',
            message: 'CRITICAL: User admin@company.com failed login from 192.168.1.1 (PII Check!)'
        }, {
            headers: { 'X-API-KEY': tempKey }
        });

        console.log('✅ Log Sent! Check your browser Live Tail.');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
}

sendTestLog();
