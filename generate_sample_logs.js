// Script to generate sample logs for training

const API_URL = 'http://localhost:4000';

// Sample log messages with different severity levels
const sampleLogs = [
    // ERROR/FATAL logs (label: 1)
    { level: 'FATAL', source: 'auth-service', message: 'Database connection failed: timeout after 30s' },
    { level: 'ERROR', source: 'user-service', message: 'Failed to authenticate user: invalid token' },
    { level: 'FATAL', source: 'payment-service', message: 'Critical: Payment gateway unreachable' },
    { level: 'ERROR', source: 'api-gateway', message: 'Request failed with status 500: Internal server error' },
    { level: 'FATAL', source: 'db-replicator', message: 'Replication stopped: master node unavailable' },
    { level: 'ERROR', source: 'auth-service', message: 'Login attempt failed: incorrect password' },
    { level: 'FATAL', source: 'user-service', message: 'Out of memory exception in user profile service' },
    { level: 'ERROR', source: 'payment-service', message: 'Transaction declined: insufficient funds' },
    { level: 'FATAL', source: 'api-gateway', message: 'Service crashed: null pointer exception' },
    { level: 'ERROR', source: 'db-replicator', message: 'Query timeout: slow query detected' },
    
    // INFO/WARN/DEBUG logs (label: 0)
    { level: 'INFO', source: 'auth-service', message: 'User logged in successfully' },
    { level: 'INFO', source: 'user-service', message: 'User profile updated' },
    { level: 'WARN', source: 'payment-service', message: 'Payment processing took longer than expected: 2500ms' },
    { level: 'INFO', source: 'api-gateway', message: 'Request processed successfully in 45ms' },
    { level: 'DEBUG', source: 'db-replicator', message: 'Replication lag: 100ms' },
    { level: 'INFO', source: 'auth-service', message: 'Password reset email sent' },
    { level: 'WARN', source: 'user-service', message: 'Cache miss for user profile' },
    { level: 'INFO', source: 'payment-service', message: 'Payment processed successfully' },
    { level: 'DEBUG', source: 'api-gateway', message: 'Health check passed' },
    { level: 'INFO', source: 'db-replicator', message: 'Database backup completed' },
];

async function generateLogs() {
    console.log('Generating sample logs...');
    
    // First, register a user and get a token
    const registerRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            organizationName: 'Test Org'
        })
    });
    
    let token;
    if (registerRes.ok) {
        const data = await registerRes.json();
        token = data.token;
        console.log('User registered successfully');
    } else {
        // Try to login if user already exists
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password123'
            })
        });
        const data = await loginRes.json();
        token = data.token;
        console.log('User logged in successfully');
    }
    
    // Generate logs
    for (let i = 0; i < sampleLogs.length; i++) {
        const log = sampleLogs[i];
        const timestamp = new Date(Date.now() - (sampleLogs.length - i) * 60000).toISOString();
        
        const res = await fetch(`${API_URL}/api/logs/ingest`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                timestamp,
                level: log.level,
                message: log.message,
                source: log.source
            })
        });
        
        if (res.ok) {
            console.log(`✓ Created ${log.level} log: ${log.message.substring(0, 50)}...`);
        } else {
            console.error(`✗ Failed to create log: ${await res.text()}`);
        }
    }
    
    console.log(`\n✅ Generated ${sampleLogs.length} sample logs!`);
    console.log('\nNow you can:');
    console.log('1. Go to Pro AI Dashboard');
    console.log('2. Change Dataset to "custom"');
    console.log('3. Click "Start Training"');
}

generateLogs().catch(console.error);
