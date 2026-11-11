import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import process from 'process';

// Load environment variables IMMEDIATELY before any other internal imports
dotenv.config();

// If API keys are missing, try loading from the project root directory
if (!process.env.API_KEY && !process.env.OPENAI_API_KEY) {
    const scriptDir = __dirname;
    dotenv.config({ path: path.join(scriptDir, '../.env') });
}

import http from 'http';
import { connectDb } from './database';
import { startLogGeneration } from './logGenerationService';
import { initializeWebSocket } from './websocket';
import { startLogRetention } from './logRetentionService';

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
import runbookRouter from './runbook.routes';

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
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import * as crypto from 'crypto';
import xss from 'xss';
import helmet from 'helmet';

// 0. Security Headers (Helmet)
const isProduction = !!process.env.FRONTEND_URL;
const cspDirectives = isProduction
    ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite builds need inline
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: [
                "'self'",
                'https://*.railway.app',
                'https://*.onrender.com',
                'https://*.vercel.app',
                'wss://*.railway.app',
                'wss://*.onrender.com',
                process.env.FRONTEND_URL as string,
            ],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"], // Prevents clickjacking
            upgradeInsecureRequests: [],
        },
    }
    : false; // CSP disabled in local dev to avoid blocking Vite HMR

app.use(helmet({
    contentSecurityPolicy: cspDirectives,
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
    // Log ingestion has its own per-API-key limit (below) and is NOT counted here.
    skip: (req) => req.originalUrl.startsWith('/api/ingest'),
});
app.use('/api', limiter);

// 1b. Log-ingestion rate limiting: per API key, per second (INGEST_RATE_LIMIT_PER_SECOND, default 100).
// Requests without an API key are counted per IP (they are rejected by the ingest route anyway).
const ingestPerSecond = Math.max(1, parseInt(process.env.INGEST_RATE_LIMIT_PER_SECOND || '100', 10) || 100);
const ingestLimiter = rateLimit({
    windowMs: 1000,
    limit: ingestPerSecond,
    keyGenerator: (req) => {
        const key = req.header('X-API-KEY');
        return key
            ? 'apikey:' + crypto.createHash('sha256').update(key).digest('hex')   // never keep the raw key
            : 'ip:' + ipKeyGenerator(req.ip || '');
    },
    message: { message: `Too many log ingestion requests: limit is ${ingestPerSecond} per second per API key.` },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false },
});
app.use('/api/ingest', ingestLimiter);
console.log(`Ingest rate limit: ${ingestPerSecond} requests/second per API key (general /api limit: 1000 per 15 min per IP, ingest excluded).`);

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
    // /api/ingest sanitises the logs itself (ingestion.routes.ts): it must score the ORIGINAL text with the
    // anomaly model and store only the xss-cleaned, privacy-masked text.
    if (req.body && !req.originalUrl.startsWith('/api/ingest')) {
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

// Health endpoint — responds even before DB is ready so Railway knows the process is alive
let dbReady = false;
app.get('/api/health', (_req, res) => {
    res.status(dbReady ? 200 : 503).json({
        status: dbReady ? 'ok' : 'starting',
        db: dbReady ? 'connected' : 'connecting',
        uptime: process.uptime(),
        testMode: process.env.TEST_MODE === 'true',
        anomalyModel: process.env.ANOMALY_MODEL === 'cascade' ? 'cascade' : 'keyword-rule',
    });
});

// Gate all API routes (except health) — return 503 while DB is connecting
// This prevents getDb() from throwing and crashing the process
app.use('/api', (req, res, next) => {
    if (dbReady || req.path === '/health') return next();
    res.status(503).json({
        message: 'Server is starting up. Please try again in a few seconds.',
        status: 'starting',
    });
});

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
app.use('/api/incidents', incidentRouter);
app.use('/api/connectors', connectorRoutes);
app.use('/api/alerts', alertsRouter);
app.use('/api/logs/pipelines', pipelineRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/runbooks', runbookRouter);

// Public Ingestion Route
app.use('/api/ingest', ingestionRouter);

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

        if (process.env.TEST_MODE === 'true') console.log('TEST_MODE=true: all e-mail/SMS/webhook/Slack/Teams/Telegram notifications are blocked.');
        // Start the background demo log generation service (synthetic demo logs).
        // Set DISABLE_DEMO_LOGS=true in backend/.env to run with real ingested logs only.
        if (process.env.DISABLE_DEMO_LOGS === 'true') {
            console.log('Demo log generation DISABLED (DISABLE_DEMO_LOGS=true): only real ingested logs will appear.');
        } else {
            startLogGeneration();
        }

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