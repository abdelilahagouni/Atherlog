
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://admin:password123@localhost:5435/ailoganalyzer"
});

async function checkPipelines() {
    try {
        console.log('🔍 Checking Log Pipelines...');
        const res = await pool.query('SELECT name, enabled, "createdAt" FROM log_pipelines ORDER BY "createdAt" DESC');
        
        if (res.rows.length === 0) {
            console.log('ℹ️  No pipelines found.');
        } else {
            console.log(`✅ Found ${res.rows.length} pipeline(s):`);
            res.rows.forEach(p => {
                console.log(`   - "${p.name}" (Enabled: ${p.enabled})`);
            });
        }
    } catch (e) {
        console.error('❌ Error checking pipelines:', e.message);
    } finally {
        await pool.end();
    }
}

checkPipelines();
