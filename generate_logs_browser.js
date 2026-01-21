// Simple script to generate sample logs via browser console
// Copy and paste this into your browser console while logged into the app

const sampleLogs = [
    // ERROR/FATAL logs
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
    
    // INFO/WARN/DEBUG logs  
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
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        console.error('❌ Not logged in! Please log in first.');
        return;
    }
    
    console.log('Generating sample logs...');
    let successCount = 0;
    
    for (const log of sampleLogs) {
        const timestamp = new Date(Date.now() - Math.random() * 86400000).toISOString();
        
        try {
            const res = await fetch('/api/logs', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    timestamp,
                    level: log.level,
                    message: log.message,
                    source: log.source,
                    anomalyScore: log.level === 'FATAL' || log.level === 'ERROR' ? 0.8 : 0.2
                })
            });
            
            if (res.ok) {
                successCount++;
                console.log(`✓ ${log.level}: ${log.message.substring(0, 50)}...`);
            } else {
                console.error(`✗ Failed: ${await res.text()}`);
            }
        } catch (e) {
            console.error(`✗ Error: ${e.message}`);
        }
    }
    
    console.log(`\n✅ Generated ${successCount}/${sampleLogs.length} logs!`);
    console.log('\nNow you can train on custom data:');
    console.log('1. Go to Pro AI Dashboard');
    console.log('2. Scroll to Model Training Laboratory');
    console.log('3. Change Dataset to "custom"');
    console.log('4. Click "Start Training"');
    console.log('\nThe model will learn: ERROR/FATAL = label 1, INFO/WARN/DEBUG = label 0');
}

// Run it!
generateLogs();
