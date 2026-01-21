export const DEMO_DATASET = [
  // Normal traffic
  { timestamp: new Date().toISOString(), level: 'INFO', source: 'api-gateway', message: 'Incoming request GET /api/v1/products', anomalyScore: 0.02 },
  { timestamp: new Date(Date.now() - 1000).toISOString(), level: 'INFO', source: 'auth-service', message: 'User login successful: user_123', anomalyScore: 0.01 },
  { timestamp: new Date(Date.now() - 2000).toISOString(), level: 'INFO', source: 'db-cluster', message: 'Query executed in 12ms', anomalyScore: 0.05 },
  
  // Security Incident: Brute Force Attempt
  { timestamp: new Date(Date.now() - 5000).toISOString(), level: 'WARN', source: 'auth-service', message: 'Failed login attempt for user: admin from IP 192.168.1.50', anomalyScore: 0.65 },
  { timestamp: new Date(Date.now() - 5500).toISOString(), level: 'WARN', source: 'auth-service', message: 'Failed login attempt for user: admin from IP 192.168.1.50', anomalyScore: 0.68 },
  { timestamp: new Date(Date.now() - 6000).toISOString(), level: 'WARN', source: 'auth-service', message: 'Failed login attempt for user: admin from IP 192.168.1.50', anomalyScore: 0.72 },
  { timestamp: new Date(Date.now() - 6500).toISOString(), level: 'ERROR', source: 'auth-service', message: 'Multiple failed login attempts detected. Account locked: admin', anomalyScore: 0.95 },

  // System Failure: Database Timeout
  { timestamp: new Date(Date.now() - 10000).toISOString(), level: 'WARN', source: 'db-cluster', message: 'Connection pool usage at 85%', anomalyScore: 0.45 },
  { timestamp: new Date(Date.now() - 11000).toISOString(), level: 'ERROR', source: 'db-cluster', message: 'Connection timeout: unable to acquire connection from pool', anomalyScore: 0.88 },
  { timestamp: new Date(Date.now() - 11500).toISOString(), level: 'FATAL', source: 'api-gateway', message: 'Service unavailable: 503 Service Temporarily Unavailable', anomalyScore: 0.99 },
  
  // Application Error: Null Pointer
  { timestamp: new Date(Date.now() - 15000).toISOString(), level: 'ERROR', source: 'payment-service', message: 'NullPointerException in ProcessPayment()', anomalyScore: 0.85 },
  { timestamp: new Date(Date.now() - 15500).toISOString(), level: 'INFO', source: 'payment-service', message: 'Transaction rolled back: tx_998877', anomalyScore: 0.10 },

  // Distributed Tracing / Microservices interaction
  { timestamp: new Date(Date.now() - 20000).toISOString(), level: 'INFO', source: 'frontend-app', message: 'User clicked "Checkout"', anomalyScore: 0.01 },
  { timestamp: new Date(Date.now() - 20100).toISOString(), level: 'INFO', source: 'order-service', message: 'Order created: ord_555', anomalyScore: 0.02 },
  { timestamp: new Date(Date.now() - 20200).toISOString(), level: 'INFO', source: 'inventory-service', message: 'Stock reserved for item: item_777', anomalyScore: 0.03 },
  { timestamp: new Date(Date.now() - 20300).toISOString(), level: 'INFO', source: 'shipping-service', message: 'Shipping label generated', anomalyScore: 0.02 },
  
  // Anomaly: Unusual Traffic Spike
  { timestamp: new Date(Date.now() - 30000).toISOString(), level: 'WARN', source: 'load-balancer', message: 'Traffic spike detected: 5000 req/s', anomalyScore: 0.75 },
  { timestamp: new Date(Date.now() - 30500).toISOString(), level: 'WARN', source: 'auto-scaler', message: 'Scaling up: added 5 instances', anomalyScore: 0.60 },
];

export const generateLargeDataset = (count: number) => {
  const sources = ['api-gateway', 'auth-service', 'db-cluster', 'payment-service', 'frontend-app'];
  const levels = ['INFO', 'WARN', 'ERROR', 'FATAL', 'DEBUG'];
  const messages = [
    'Request processed successfully',
    'Cache miss',
    'Database query slow',
    'User authentication failed',
    'Payment gateway timeout',
    'Disk space low',
    'Memory usage high',
    'Garbage collection started',
    'Service health check passed',
    'Connection reset by peer'
  ];

  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
    level: levels[Math.floor(Math.random() * levels.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    message: messages[Math.floor(Math.random() * messages.length)] + ` [id:${Math.floor(Math.random() * 10000)}]`,
    anomalyScore: Math.random()
  }));
};
