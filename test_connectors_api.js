
const fetch = require('node-fetch'); // Or use global fetch if Node 18+

const API_URL = 'http://localhost:4000/api';

async function runTest() {
    console.log('--- Starting Enterprise Connectors API Test ---');

    // 1. Register/Login to get token
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'password123';
    let token = '';

    console.log(`1. Registering user: ${email}`);
    try {
        const regRes = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'TestUser',
                email: email,
                password: password,
                organizationName: 'TestOrg',
                jobTitle: 'Tester'
            })
        });
        
        if (!regRes.ok) {
            // If user exists (unlikely with timestamp), try login
             console.log('   Registration failed (maybe exists), trying login...');
        }

        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
        const loginData = await loginRes.json();
        token = loginData.token;
        console.log('   Login successful. Token obtained.');

    } catch (e) {
        console.error('   Authentication failed:', e.message);
        return;
    }

    // 2. List Connectors
    console.log('\n2. Fetching Connectors List...');
    try {
        const listRes = await fetch(`${API_URL}/connectors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!listRes.ok) throw new Error(`List failed: ${listRes.statusText}`);
        const connectors = await listRes.json();
        console.log(`   Success! Found ${connectors.length} connectors.`);
        console.log(`   Connectors: ${connectors.map(c => c.name).join(', ')}`);
    } catch (e) {
        console.error('   List connectors failed:', e.message);
    }

    // 3. Configure AWS Connector
    console.log('\n3. Configuring AWS Connector...');
    try {
        const configRes = await fetch(`${API_URL}/connectors/aws/config`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                accessKeyId: 'AKIA_TEST_KEY',
                secretAccessKey: 'SECRET_KEY',
                region: 'us-east-1'
            })
        });
        if (!configRes.ok) throw new Error(`Config failed: ${configRes.statusText}`);
        const configData = await configRes.json();
        console.log('   Configuration saved:', configData.message);
    } catch (e) {
        console.error('   Configure failed:', e.message);
    }

    // 4. Test AWS Connection
    console.log('\n4. Testing AWS Connection (Mock)...');
    try {
        const testRes = await fetch(`${API_URL}/connectors/aws/test`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                accessKeyId: 'AKIA_TEST_KEY'
            })
        });
        if (!testRes.ok) throw new Error(`Test connection failed: ${testRes.statusText}`);
        const testData = await testRes.json();
        console.log('   Connection Test Result:', testData.message);
        console.log('   Latency:', testData.latency);
    } catch (e) {
        console.error('   Test connection failed:', e.message);
    }

    console.log('\n--- Test Complete ---');
}

runTest();
