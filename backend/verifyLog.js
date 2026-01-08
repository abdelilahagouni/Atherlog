const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://admin:password123@localhost:5435/ailoganalyzer'
});

async function run() {
    try {
        const res = await pool.query("SELECT * FROM logs WHERE message = 'CRITICAL: Database connection lost!'");
        console.log(res.rows);
    } catch (e) {
        console.error('Error verifying log insertion:', e);
    }
}

run().finally(() => pool.end());
