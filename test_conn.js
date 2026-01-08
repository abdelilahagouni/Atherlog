import http from 'http';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/health',
  method: 'GET'
};

console.log(`Testing connectivity to: http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response Data:', data);
  });
});

req.on('error', (error) => {
  console.error('Connectivity Error:', error.message);
});

req.end();
