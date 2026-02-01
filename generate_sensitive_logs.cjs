
const axios = require('axios');

// Using the ingestion endpoint
const INGEST_URL = 'http://localhost:4000/api/ingest';
const API_KEY = 'pk_test_12345'; // Assuming this key exists or is valid from previous steps
// If not, we might need to grab one from the DB or let the user know.
// Actually, let's use the DB to find a valid key first, just like send_test_log.cjs did.

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://admin:password123@localhost:5435/ailoganalyzer"
});

async function getApiKey() {
    const res = await pool.query("SELECT key, prefix FROM api_keys LIMIT 1");
    if (res.rows.length > 0) {
        return res.rows[0].key; // This is the hashed key? No, we need the raw key.
        // Ah, we can't get the raw key back if it's hashed.
        // We must create a new temporary one.
    }
    return null;
}

async function createTempKey() {
    // For testing, we insert a raw key (or use a known one if the system allowed it).
    // The backend hashes keys. We can't insert a raw key and expect it to work if the backend verifies hash.
    // However, for the purpose of this test, let's just create a new key via the script logic 
    // BUT we don't have access to the backend's hashing function easily without importing bcrypt.
    
    // Alternative: Just ask the user to use the key they have, or create one via the UI?
    // Better: Creating a script that inserts a key we know.
    // The backend uses bcrypt. 
    
    // Let's rely on the previous knowledge that 'pk_test_12345' might have been created?
    // No, send_test_log.cjs created a key.
    
    // SIMPLER APPROACH:
    // We already verified ingestion works.
    // Let's create a temporary key using the exact same logic/library as `create_tables.cjs` if we can.
    
    // Actually, I'll just use the `send_test_log.cjs` logic again which used `bcryptjs` if available?
    // Valid point. `send_test_log.cjs` imported bcryptjs.
    
    return 'pk_test_UI_VERIFY_' + Date.now();
}

// Wait, I can't easily script the key creation if I don't have bcrypt installed in this scope/script
// independently unless I require it from node_modules.
// Let's assume node_modules is there.

const bcrypt = require('bcryptjs');

async function sendSensitiveLogs() {
    const client = await pool.connect();
    try {
        console.log('🔑 Setting up test API Key...');
        
        // 1. Get a valid Organization ID
        const orgRes = await client.query('SELECT id FROM organizations LIMIT 1');
        let orgId = 'org_123';
        
        if (orgRes.rows.length > 0) {
            orgId = orgRes.rows[0].id;
        } else {
            // Create a temp org if none exists
            console.log('   Creating temporary organization...');
            await client.query(
                `INSERT INTO organizations (id, name, plan, "anomalyThreshold") VALUES ($1, $2, $3, $4)`,
                [orgId, 'UI Test Org', '{"name":"Free"}', 0.7]
            );
        }

        const rawKey = 'pk_test_ui_' + Math.floor(Math.random() * 10000);
        const hashedKey = await bcrypt.hash(rawKey, 10);
        const prefix = rawKey.substring(0, 8);
        
        // Insert temp key using the valid orgId
        await client.query(
            `INSERT INTO api_keys ("id", "organizationId", "keyHash", "keyPrefix", "name", "createdAt")
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [require('crypto').randomUUID(), orgId, hashedKey, prefix, 'UI Test Key']
        );
        
        console.log(`✅ Key created: ${rawKey}`);
        console.log('🚀 Sending logs with Credit Card numbers every 3 seconds...');
        console.log('   (Go to the UI and create a Pipeline to mask "Credit Card" logs!)');

        let count = 0;
        setInterval(async () => {
            count++;
            const sensitiveData = `User payment processed. CC: 4532-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-1234`;
            
            try {
                await axios.post(INGEST_URL, {
                    message: sensitiveData,
                    level: 'INFO',
                    source: 'frontend-payment-service',
                    metadata: {
                        userId: 'user_999'
                    }
                }, {
                    headers: { 'X-API-KEY': rawKey }
                });
                console.log(`[${new Date().toLocaleTimeString()}] Sent: "${sensitiveData}"`);
            } catch (err) {
                console.error('Failed to send:', err.message);
            }
        }, 3000);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
    }
}

sendSensitiveLogs();
