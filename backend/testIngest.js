const http = require('http');

const data = JSON.stringify({
    level: 'ERROR',
    message: 'CRITICAL: Database connection lost!',
    source: 'AuthService',
    anomalyScore: 0.95
});

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/ingest',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-API-KEY': 'AETHER_1234567890'
    }
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
