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

// Middleware
// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173', 
    'http://localhost:4173', 
    process.env.FRONTEND_URL // Add the production frontend URL
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || !process.env.FRONTEND_URL) {
            // If origin is in the list, or if FRONTEND_URL is not set (dev mode), allow it
            callback(null, true);
        } else {
            // For now, in production debugging, let's be permissive if the exact match fails
            // but log it so we know.
            console.log('CORS Origin Check:', origin, 'Allowed:', allowedOrigins);
            // callback(new Error('Not allowed by CORS'));
            callback(null, true); // Permissive mode for troubleshooting
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies, increase limit for images

// --- Security Middleware ---
import rateLimit from 'express-rate-limit';
import xss from 'xss';

// 1. Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs (increased for dashboard usage)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter); // Apply to all API routes

// 2. Input Sanitization Middleware
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


// Create HTTP server for WebSocket support
const httpServer = http.createServer(app);

// Start server
const startServer = async () => {
    try {
        await connectDb();
        console.log('Database connected successfully.');

        // Initialize WebSocket server for real-time streaming
        initializeWebSocket(httpServer);
        console.log('WebSocket server initialized for real-time streaming.');
        
        // Start the background log generation service
        startLogGeneration();

        // Start log retention cleanup service
        startLogRetention();

        httpServer.listen(PORT, () => {
            console.log(`Backend server is running on http://localhost:${PORT}`);
            console.log(`WebSocket available at ws://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Failed to start server:', e);
        process.exit(1);
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