const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://admin:password123@localhost:5435/ailoganalyzer'
});

async function run() {
    try {
        const res = await pool.query('SELECT id, name, "keyPrefix", "keyHash" FROM api_keys');
        console.log(res.rows);
    } catch (e) {
        console.error('Error inspecting API keys:', e);
    }
}

run().finally(() => pool.end());
