// LiveTail.tsx - Real-time log streaming component
import * as React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import webSocketService, { LogStreamEvent } from '../services/webSocketService';
import { soundNotificationService } from '../services/soundNotificationService';

interface LiveTailProps {
    maxLogs?: number;
}

const LogLevelBadge: React.FC<{ level: string }> = ({ level }) => {
    const colors: Record<string, string> = {
        ERROR: 'bg-red-500/20 text-red-400 border-red-500/50',
        WARN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
        INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        DEBUG: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
        CRITICAL: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    };
    return (
        <span className={`px-2 py-0.5 rounded border text-xs font-mono ${colors[level] || colors.INFO}`}>
            {level}
        </span>
    );
};

const LiveTail: React.FC<LiveTailProps> = ({ maxLogs = 500 }) => {
    const { token } = useAuth();
    const [logs, setLogs] = useState<LogStreamEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState<string>('ALL');
    const [sourceFilter, setSourceFilter] = useState<string>('');
    const [logsPerSecond, setLogsPerSecond] = useState(0);
    const [totalReceived, setTotalReceived] = useState(0);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const liveTailRef = useRef<HTMLDivElement>(null); // Added this ref as per instruction
    const logCountRef = useRef(0);
    const lastCountTime = useRef(Date.now());

    // Connect to WebSocket
    useEffect(() => {
        let isMounted = true;
        
        if (!token) {
            console.log('[LiveTail] No token available');
            setConnectionError('Authentication token missing. Please log in again.');
            return;
        }

        console.log('[LiveTail] Attempting to connect to WebSocket...');

        const connect = async () => {
            try {
                setConnectionError(null); // Clear previous errors before attempting to connect
                await webSocketService.connect(token);
                if (isMounted) {
                    console.log('[LiveTail] WebSocket connected successfully');
                    setIsConnected(true);
                }
            } catch (err: any) {
                console.error('[LiveTail] WebSocket connection failed:', err);
                if (isMounted) {
                    setIsConnected(false);
                    // Extract meaningful error message
                    const msg = err.message || err.toString();
                    setConnectionError(`Connection Failed: ${msg}. Check console for details.`);
                }
            }
        };

        connect();

        // Listen for socket errors specifically
        const socket = webSocketService.getSocket();
        if (socket) {
            socket.on('connect_error', (err) => {
                 if (isMounted) {
                    console.error('[LiveTail] Socket connect_error:', err);
                    setConnectionError(`Connection Error: ${err.message}. Please check your network or try again.`);
                    setIsConnected(false);
                 }
            });
        }

        return () => {
            isMounted = false;
            console.log('[LiveTail] Disconnecting WebSocket...');
            webSocketService.disconnect();
            setIsConnected(false);
            if (socket) {
                socket.off('connect_error');
            }
        };
    }, [token]);

    const handleRetry = () => {
        if (!token) return;
        setIsConnected(false);
        webSocketService.disconnect();
        webSocketService.connect(token)
            .then(() => setIsConnected(true))
            .catch(err => console.error('[LiveTail] Retry failed:', err));
    };

    // Listen for new logs
    useEffect(() => {
        const handleNewLog = (log: LogStreamEvent) => {
            setLogs(prev => {
                const newLogs = [...prev, log];
                // Keep only the last maxLogs entries
                if (newLogs.length > maxLogs) {
                    return newLogs.slice(-maxLogs);
                }
                return newLogs;
            });
            
            setTotalReceived(prev => prev + 1);
            logCountRef.current++;
            
            // Play sound for FATAL logs
            if (log.level === 'FATAL') {
                soundNotificationService.playSound('fatal');
            }
        };

        webSocketService.on('log:new', handleNewLog);

        return () => {
            webSocketService.off('log:new', handleNewLog);
        };
    }, [maxLogs]);

    // Calculate logs per second
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - lastCountTime.current) / 1000;
            setLogsPerSecond(Math.round(logCountRef.current / elapsed));
            logCountRef.current = 0;
            lastCountTime.current = now;
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handlePauseResume = useCallback(() => {
        if (isPaused) {
            webSocketService.resume();
            setIsPaused(false);
        } else {
            webSocketService.pause();
            setIsPaused(true);
        }
    }, [isPaused]);

    const handleClear = useCallback(() => {
        setLogs([]);
        setTotalReceived(0);
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Disable auto-scroll if user scrolls up
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
    }, []);

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const matchesText = !filter || 
            log.message.toLowerCase().includes(filter.toLowerCase()) ||
            log.source.toLowerCase().includes(filter.toLowerCase());
        const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
        const matchesSource = !sourceFilter || log.source === sourceFilter;
        return matchesText && matchesLevel && matchesSource;
    });

    // Get unique sources for filter dropdown
    const sources = Array.from(new Set(logs.map(l => l.source)));

    return (
        <div className="p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Icon name="activity" className="w-7 h-7 text-green-400" />
                        Live Tail
                        {isConnected && (
                            <span className="flex items-center gap-1.5 text-sm font-normal text-green-400">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Connected
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Real-time log streaming • {logsPerSecond} logs/sec • {totalReceived.toLocaleString()} total
                    </p>
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePauseResume}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            isPaused 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        }`}
                    >
                        <Icon name={isPaused ? 'play' : 'pause'} className="w-4 h-4" />
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                    >
                        <Icon name="trash" className="w-4 h-4" />
                        Clear
                    </button>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            autoScroll 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-gray-700 hover:bg-gray-600 text-white'
                        }`}
                    >
                        <Icon name="arrow-down" className="w-4 h-4" />
                        Auto-scroll
                    </button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Filter logs..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <select
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value)}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">All Levels</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="ERROR">Error</option>
                        <option value="WARN">Warning</option>
                        <option value="INFO">Info</option>
                        <option value="DEBUG">Debug</option>
                    </select>
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Sources</option>
                        {sources.map(source => (
                            <option key={source} value={source}>{source}</option>
                        ))}
                    </select>
                </div>
            </Card>

            {/* Log Stream */}
            <Card className="overflow-hidden">
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="h-[600px] overflow-y-auto bg-gray-950 font-mono text-sm"
                >
                    {!isConnected ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center p-8 bg-gray-900/50 rounded-xl border border-gray-800">
                                <Icon name="loader" className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-500" />
            <h3 className="text-lg font-semibold text-white mb-2">Connecting to log stream...</h3>
            <p className="text-sm text-gray-400 mb-6">Establishing secure WebSocket connection to backend</p>
            
            {connectionError && (
                <div className="mb-6 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm max-w-md mx-auto">
                    <Icon name="alert-triangle" className="w-4 h-4 inline mr-2 text-red-500" />
                    {connectionError}
                </div>
            )}

            <button
                onClick={handleRetry}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 flex items-center gap-2 mx-auto"
            >
                                    <Icon name="rollback" className="w-4 h-4" />
                                    Retry Connection
                                </button>
                            </div>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                                <Icon name="inbox" className="w-8 h-8 mx-auto mb-2" />
                                <p>Waiting for logs...</p>
                                <p className="text-sm mt-1">Logs will appear here in real-time</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-800/50">
                            {filteredLogs.map((log, index) => (
                                <div 
                                    key={log.id || index}
                                    className={`px-4 py-2 hover:bg-gray-900/50 transition-colors ${
                                        log.level === 'ERROR' || log.level === 'CRITICAL' 
                                            ? 'bg-red-950/20' 
                                            : log.level === 'WARN' 
                                            ? 'bg-yellow-950/10' 
                                            : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-gray-500 whitespace-nowrap text-xs">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                        <LogLevelBadge level={log.level} />
                                        <span className="text-cyan-400 whitespace-nowrap">
                                            [{log.source}]
                                        </span>
                                        <span className="text-gray-300 break-all">
                                            {log.message}
                                        </span>
                                        {log.anomalyScore && log.anomalyScore > 0.7 && (
                                            <span className="ml-auto px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs whitespace-nowrap">
                                                ⚠️ Anomaly: {(log.anomalyScore * 100).toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Footer with stats */}
                <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between text-sm text-gray-400">
                    <span>
                        Showing {filteredLogs.length} of {logs.length} logs
                        {filter && ` • Filtered by "${filter}"`}
                    </span>
                    {isPaused && (
                        <span className="flex items-center gap-1 text-yellow-400">
                            <Icon name="pause" className="w-4 h-4" />
                            Paused
                        </span>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default LiveTail;
