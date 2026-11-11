// Creates a LOCAL test organisation, a verified OWNER user and an API key in the local dev database,
// without the signup e-mail. Credentials are written to TEST_ACCOUNT.txt next to this script (not printed).
// Run from the backend folder so its node_modules are used:  node ../app_real_log_test/create_test_account.cjs
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require(path.join(process.cwd(), 'node_modules', 'dotenv')).config({ path: path.join(process.cwd(), '.env') });
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));
const { Client } = require(path.join(process.cwd(), 'node_modules', 'pg'));

(async () => {
  const c = new Client({ host: process.env.POSTGRES_HOST, port: +process.env.POSTGRES_PORT, user: process.env.POSTGRES_USER,
                         password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
  await c.connect();
  const orgName = 'Real-Log-Test (local)';
  if ((await c.query('SELECT 1 FROM organizations WHERE name=$1', [orgName])).rowCount) {
    console.log('Test organisation already exists - nothing created.'); await c.end(); return;
  }
  const plan = (await c.query(`SELECT plan FROM organizations WHERE plan LIKE '%"Free"%' LIMIT 1`)).rows[0].plan;
  const orgId = crypto.randomUUID(), userId = crypto.randomUUID(), keyId = crypto.randomUUID();
  const username = 'reallogtest', password = crypto.randomBytes(12).toString('base64url');
  const rawKey = 'al_' + crypto.randomBytes(24).toString('base64url');
  await c.query('INSERT INTO organizations (id, name, plan) VALUES ($1,$2,$3)', [orgId, orgName, plan]);
  await c.query(`INSERT INTO users (id, "organizationId", username, password, role, email, "jobTitle", "isVerified")
                 VALUES ($1,$2,$3,$4,'OWNER',$5,'Tester',true)`,
                [userId, orgId, username, await bcrypt.hash(password, 10), 'reallogtest@example.test']);
  await c.query(`INSERT INTO api_keys (id, name, "keyHash", "keyPrefix", "organizationId") VALUES ($1,$2,$3,$4,$5)`,
                [keyId, 'real-bgl-ingest', await bcrypt.hash(rawKey, 10), rawKey.substring(0, 8), orgId]);
  await c.end();
  const out = path.join(__dirname, 'TEST_ACCOUNT.txt');
  fs.writeFileSync(out, `LOCAL test account (local dev database only, not a real service)\n` +
    `Organisation: ${orgName}\nUsername: ${username}\nPassword: ${password}\nAPI key (X-API-KEY): ${rawKey}\n` +
    `Organisation id: ${orgId}\nTo remove: delete the organisation, user and api key with these ids from the local DB.\n`);
  console.log('Created test organisation, user and API key. Credentials saved to ' + out);
})().catch(e => { console.error(e.message); process.exit(1); });
