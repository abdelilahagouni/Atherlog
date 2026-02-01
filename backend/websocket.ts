// Real-time WebSocket server for live log streaming
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables explicitly to ensure JWT_SECRET is correct
dotenv.config(); 
if (!process.env.JWT_SECRET) {
    // Try root .env if not found in current dir
    dotenv.config({ path: path.join(__dirname, '../.env') });
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-should-be-in-an-env-file';

let io: Server | null = null;

// Event types for real-time streaming
export interface LogStreamEvent {
    id: string;
    organizationId: string;
    timestamp: string;
    level: string;
    message: string;
    source: string;
    anomalyScore?: number;
}

export interface AlertStreamEvent {
    id: string;
    organizationId: string;
    type: string;
    severity: string;
    message: string;
    source?: string;
    timestamp: string;
}

/**
 * Initialize WebSocket server with authentication
 */
export const initializeWebSocket = (httpServer: HttpServer): Server => {
    io = new Server(httpServer, {
        cors: {
            origin: [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://localhost:4173',
                process.env.FRONTEND_URL || ''
            ].filter(Boolean),
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Authentication middleware
    io.use((socket: Socket, next) => {
        console.log(`[WebSocket] Connection attempt from ${socket.id}`);
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        
        console.log(`[WebSocket] Secret used (first 5 chars): ${JWT_SECRET.substring(0, 5)}...`);

        if (!token) {
            console.error(`[WebSocket] Connection rejected: No token provided for ${socket.id}`);
            return next(new Error('Authentication required'));
        }

        console.log(`[WebSocket] Token received (first 10 chars): ${token.toString().substring(0, 10)}...`);

        try {
            const decoded = jwt.verify(token as string, JWT_SECRET) as any;
            socket.data.user = decoded;
            socket.data.organizationId = decoded.organizationId;
            console.log(`[WebSocket] Authentication successful for ${socket.id} (org: ${decoded.organizationId})`);
            next();
        } catch (err: any) {
            console.error(`[WebSocket] Authentication failed for ${socket.id}:`, err.message);
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const { organizationId } = socket.data;
        
        console.log(`[WebSocket] Connection established for ${socket.id}`);
        
        // Join organization room for filtered broadcasts
        socket.join(`org:${organizationId}`);
        
        // Handle subscription to specific log sources
        socket.on('subscribe:source', (source: string) => {
            socket.join(`org:${organizationId}:source:${source}`);
            console.log(`[WebSocket] ${socket.id} subscribed to source: ${source}`);
        });

        socket.on('unsubscribe:source', (source: string) => {
            socket.leave(`org:${organizationId}:source:${source}`);
            console.log(`[WebSocket] ${socket.id} unsubscribed from source: ${source}`);
        });

        // Handle subscription to specific log levels
        socket.on('subscribe:level', (level: string) => {
            socket.join(`org:${organizationId}:level:${level}`);
            console.log(`[WebSocket] ${socket.id} subscribed to level: ${level}`);
        });

        socket.on('unsubscribe:level', (level: string) => {
            socket.leave(`org:${organizationId}:level:${level}`);
        });

        // Handle live tail pause/resume
        socket.on('pause', () => {
            socket.data.paused = true;
            console.log(`[WebSocket] ${socket.id} paused stream`);
        });

        socket.on('resume', () => {
            socket.data.paused = false;
            console.log(`[WebSocket] ${socket.id} resumed stream`);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[WebSocket] Client disconnected: ${socket.id} (reason: ${reason})`);
        });

        socket.on('error', (error) => {
            console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
        });
    });

    console.log('[WebSocket] Real-time streaming server initialized');
    return io;
};

/**
 * Emit a new log entry to all connected clients in the organization
 */
export const emitLog = (log: LogStreamEvent): void => {
    if (!io) return;

    // Emit to all clients in the organization
    io.to(`org:${log.organizationId}`).emit('log:new', log);

    // Emit to source-specific subscribers
    io.to(`org:${log.organizationId}:source:${log.source}`).emit('log:new', log);

    // Emit to level-specific subscribers
    io.to(`org:${log.organizationId}:level:${log.level}`).emit('log:new', log);
};

/**
 * Emit a real-time alert to connected clients
 */
export const emitAlert = (alert: AlertStreamEvent): void => {
    if (!io) return;

    io.to(`org:${alert.organizationId}`).emit('alert:new', alert);
};

/**
 * Emit anomaly detection results in real-time
 */
export const emitAnomaly = (organizationId: string, anomaly: {
    logId: string;
    score: number;
    message: string;
    source: string;
}): void => {
    if (!io) return;

    io.to(`org:${organizationId}`).emit('anomaly:detected', anomaly);
};

/**
 * Get the Socket.io server instance
 */
export const getIO = (): Server | null => io;

/**
 * Get connected client count for an organization
 */
export const getConnectionCount = async (organizationId: string): Promise<number> => {
    if (!io) return 0;
    const sockets = await io.in(`org:${organizationId}`).fetchSockets();
    return sockets.length;
};

export default {
    initializeWebSocket,
    emitLog,
    emitAlert,
    emitAnomaly,
    getIO,
    getConnectionCount
};
