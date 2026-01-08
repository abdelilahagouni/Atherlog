import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDb } from './database';
import process from 'process';
import { startLogGeneration } from './logGenerationService';

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

const app: express.Express = express();
const PORT = parseInt(process.env.PORT || '4000');

// Middleware
app.use(cors()); // Allow requests from our frontend
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies, increase limit for images

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

// Public Ingestion Route
app.use('/api/ingest', ingestionRouter);


// Start server
const startServer = async () => {
    try {
        await connectDb();
        console.log('Database connected successfully.');
        
        // Start the background log generation service
        startLogGeneration();

        app.listen(PORT, () => {
            console.log(`Backend server is running on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Failed to start server:', e);
        process.exit(1);
    }
};

startServer();