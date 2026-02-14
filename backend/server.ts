import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { connectDb } from './database';
import process from 'process';
import { startLogGeneration } from './logGenerationService';
import { initializeWebSocket } from './websocket';
import { startLogRetention } from './logRetentionService';

// Load environment variables
// 1. Try default location (current directory / backend)
dotenv.config();

// 2. If API keys are missing, try loading from the project root directory
// This helps if the user created the .env file in the main folder instead of /backend
if (!process.env.API_KEY && !process.env.OPENAI_API_KEY) {
    console.log("API Keys not found in backend/.env, checking project root for .env...");
    const scriptDir = path.dirname(process.argv[1]);
    dotenv.config({ path: path.join(scriptDir, '../.env') });
}

import authRouter from './auth.routes';
import organizationRouter from './organization.routes';
import notificationRouter from './notification.routes';
import aiRouter from './ai.routes';
import logRouter from './log.routes';
import ingestionRouter from './ingestion.routes';
import apiKeyRouter from './apiKey.routes';
import savedSearchRouter from './savedSearch.routes';
import paymentRouter from './payment.routes';
import databaseRouter from './database.routes';
import incidentRouter from './incident.routes'; // Import the new incident router
import connectorRoutes from './connector.routes';
import alertsRouter from './alerts.routes';
import pipelineRouter from './pipeline.routes';

const app: express.Express = express();
const PORT = parseInt(process.env.PORT || '4000');

// Trust proxy — required for Railway/Render/Vercel reverse proxies
// so express-rate-limit and req.ip work correctly behind load balancers
app.set('trust proxy', 1);

// Middleware
// CORS Configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173', 
    'http://localhost:4173',
    'https://atherlog.vercel.app',
    'https://aetherlog.vercel.app',
    process.env.FRONTEND_URL // Add any additional production frontend URL from env
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else if (origin.endsWith('.vercel.app') || origin.endsWith('.up.railway.app')) {
            // Allow Vercel preview deployments and Railway internal calls
            callback(null, true);
        } else if (!process.env.FRONTEND_URL) {
            // Dev mode — no FRONTEND_URL set, allow all origins
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin, '| Allowed:', allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
// Parse JSON bodies — but skip for Stripe webhook which needs raw body for signature verification
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payment/webhook') {
        next(); // Skip JSON parsing — Stripe webhook handler uses express.raw()
    } else {
        express.json({ limit: '10mb' })(req, res, next);
    }
});

// --- Security Middleware ---
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import helmet from 'helmet';

// 0. Security Headers (Helmet)
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for dev — enable in production
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 1. General Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false },
});
app.use('/api', limiter);

// 2. Strict Auth Rate Limiting (prevent brute force login)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Max 20 login/signup attempts per 15 min
    message: { message: 'Too many authentication attempts. Please wait 15 minutes before trying again.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// 3. Input Sanitization Middleware
const sanitizeInput = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        }
    }
    if (req.query) {
        for (const key in req.query) {
             if (typeof req.query[key] === 'string') {
                req.query[key] = xss(req.query[key] as string);
            }
        }
    }
    next();
};
app.use(sanitizeInput);


import webhookRouter from './webhook.routes';

// ... (existing imports)

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/ai', aiRouter);
app.use('/api/logs', logRouter);
app.use('/api/keys', apiKeyRouter);
app.use('/api/searches', savedSearchRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/database', databaseRouter);
app.use('/api/incidents', incidentRouter); // Register the new incident router
app.use('/api/connectors', connectorRoutes);
app.use('/api/alerts', alertsRouter);
app.use('/api/logs/pipelines', pipelineRouter);
app.use('/api/webhooks', webhookRouter); // Register ESP Webhooks

// Public Ingestion Route
app.use('/api/ingest', ingestionRouter);

// Health endpoint — responds even before DB is ready so Railway knows the process is alive
let dbReady = false;
app.get('/api/health', (_req, res) => {
    res.status(dbReady ? 200 : 503).json({
        status: dbReady ? 'ok' : 'starting',
        db: dbReady ? 'connected' : 'connecting',
        uptime: process.uptime(),
    });
});

// Create HTTP server for WebSocket support
const httpServer = http.createServer(app);

// Start server
// IMPORTANT: Start listening FIRST so Railway sees a healthy port binding,
// then connect to the database in the background with retries.
const startServer = async () => {
    // Initialize WebSocket server for real-time streaming
    initializeWebSocket(httpServer);
    console.log('WebSocket server initialized for real-time streaming.');

    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend server is running on port ${PORT}`);
        console.log(`WebSocket available on the same port`);
    });

    // Connect to database (with retry logic inside connectDb)
    try {
        await connectDb();
        dbReady = true;
        console.log('Database connected successfully.');

        // Start the background log generation service
        startLogGeneration();

        // Start log retention cleanup service
        startLogRetention();
    } catch (e) {
        console.error('Failed to connect to database after retries:', e);
        // Don't exit — the server stays up and /api/health reports 503.
        // Railway won't kill a listening process, and the admin can check logs.
    }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    const { stopLogRetention } = await import('./logRetentionService');
    stopLogRetention();
    httpServer.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();