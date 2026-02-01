
const { Pool } = require('pg');
const axios = require('axios');

// Connect to DB (Port 5435 as debugged earlier)
const pool = new Pool({
    connectionString: "postgresql://admin:password123@localhost:5435/ailoganalyzer"
});

async function verifyEmailFlow() {
    try {
        console.log('🧪 Starting Email Deliverability Verification...');

        // 1. Setup: Ensure 'test-bounce@example.com' is CLEAN (not suppressed)
        console.log('🧹 Cleaning up test data...');
        // Corrected query syntax for valid SQL delete
        await pool.query("DELETE FROM email_suppressions WHERE email = 'test-bounce@example.com'");
        await pool.query("DELETE FROM email_events WHERE email = 'test-bounce@example.com'");


        // 2. Test: Simulate a Webhook Bounce Event (Backend should process this and suppress the email)
        console.log('📨 Simulating Webhook Bounce Event...');
        try {
            await axios.post('http://localhost:4000/api/webhooks/email', {
                type: 'bounce',
                email: 'test-bounce@example.com',
                reason: '550 User not found (Hard Bounce)'
            });
            console.log('✅ Webhook accepted.');
        } catch (e) {
            console.error('❌ Webhook failed:', e.message);
            return;
        }

        // 3. Verification: Check Database for Suppression
        console.log('🔍 Checking Database for Suppression...');
        const res = await pool.query("SELECT * FROM email_suppressions WHERE email = 'test-bounce@example.com'");
        
        if (res.rows.length > 0) {
            console.log('✅ SUCCESS: Email was correctly added to suppression list via webhook.');
            console.log(`   Reason stored: ${res.rows[0].reason?.substring(0, 50)}...`);
        } else {
            console.error('❌ FAILURE: Email was NOT found in suppression list after webhook.');
        }

        // 4. Verification: Check Event Log
        const logRes = await pool.query("SELECT * FROM email_events WHERE email = 'test-bounce@example.com'");
        console.log(`✅ Event Log Verification: Found ${logRes.rows.length} events logged.`);

    } catch (e) {
        console.error('❌ Global Error:', e);
    } finally {
        await pool.end();
    }
}

verifyEmailFlow();
