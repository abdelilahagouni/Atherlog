// WebSocket service for real-time log streaming
import { io, Socket } from 'socket.io-client';
import config from '../src/config';

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

class WebSocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isPaused = false;

    /**
     * Connect to WebSocket server with JWT authentication
     */
    connect(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            // Use the URL from central config (supports prod/dev automatically)
            const wsUrl = config.wsUrl; 

            console.log(`[WebSocket] Connecting to: ${wsUrl}`);

            this.socket = io(wsUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: this.maxReconnectAttempts
            });

            this.socket.on('connect', () => {
                console.log('[WebSocket] Connected to server');
                this.reconnectAttempts = 0;
                resolve();
            });

            this.socket.on('disconnect', (reason) => {
                console.log('[WebSocket] Disconnected:', reason);
            });

            this.socket.on('connect_error', (error) => {
                console.error('[WebSocket] Connection error:', error.message);
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    reject(new Error('Failed to connect to WebSocket server'));
                }
            });

            // Set up event forwarding
            this.socket.on('log:new', (log: LogStreamEvent) => {
                if (!this.isPaused) {
                    this.emit('log:new', log);
                }
            });

            this.socket.on('alert:new', (alert: AlertStreamEvent) => {
                this.emit('alert:new', alert);
            });

            this.socket.on('anomaly:detected', (anomaly: any) => {
                this.emit('anomaly:detected', anomaly);
            });
        });
    }

    /**
     * Get the underlying Socket.IO client instance.
     */
    public getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.listeners.clear();
    }

    /**
     * Pause log streaming (stops emitting to listeners)
     */
    pause(): void {
        this.isPaused = true;
        this.socket?.emit('pause');
    }

    /**
     * Resume log streaming
     */
    resume(): void {
        this.isPaused = false;
        this.socket?.emit('resume');
    }

    /**
     * Check if streaming is paused
     */
    get paused(): boolean {
        return this.isPaused;
    }

    /**
     * Subscribe to logs from a specific source
     */
    subscribeToSource(source: string): void {
        this.socket?.emit('subscribe:source', source);
    }

    /**
     * Unsubscribe from a specific source
     */
    unsubscribeFromSource(source: string): void {
        this.socket?.emit('unsubscribe:source', source);
    }

    /**
     * Subscribe to logs of a specific level
     */
    subscribeToLevel(level: string): void {
        this.socket?.emit('subscribe:level', level);
    }

    /**
     * Unsubscribe from a specific level
     */
    unsubscribeFromLevel(level: string): void {
        this.socket?.emit('unsubscribe:level', level);
    }

    /**
     * Add an event listener
     */
    on(event: string, callback: (data: any) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    /**
     * Remove an event listener
     */
    off(event: string, callback: (data: any) => void): void {
        this.listeners.get(event)?.delete(callback);
    }

    /**
     * Emit to all listeners for an event
     */
    private emit(event: string, data: any): void {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error('[WebSocket] Listener error:', e);
            }
        });
    }

    /**
     * Check if connected
     */
    get connected(): boolean {
        return this.socket?.connected ?? false;
    }
}

// Singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
