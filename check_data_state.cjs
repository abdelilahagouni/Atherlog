
const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://admin:password123@localhost:5435/ailoganalyzer" });

(async () => {
    try {
        console.log('Comparison of Data State:');
        console.log('--------------------------------------------------');
        
        // 1. Check API Keys and their Orgs
        const keys = await pool.query('SELECT "keyPrefix", "organizationId", name FROM api_keys WHERE name LIKE \'%UI Test%\'');
        console.log('🔑 Script API Keys:');
        if (keys.rows.length === 0) console.log('   (None found. Did the script run?)');
        keys.rows.forEach(k => console.log(`   - Prefix: ${k.keyPrefix} -> Org: ${k.organizationId}`));

        console.log('\n--------------------------------------------------');

        // 2. Check Pipelines and their Orgs
        const pipelines = await pool.query('SELECT name, "organizationId", enabled, rules FROM log_pipelines');
        console.log('🛡️  User Pipelines:');
        if (pipelines.rows.length === 0) console.log('   (None found. Did you save the pipeline?)');
        pipelines.rows.forEach(p => {
            console.log(`   - "${p.name}" (Enabled: ${p.enabled}) -> Org: ${p.organizationId}`);
            console.log(`     Rules: ${JSON.stringify(p.rules)}`);
        });

        console.log('--------------------------------------------------');
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
})();
