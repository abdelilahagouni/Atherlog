import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { getHistoricalLogs } from '../services/logService';
import { LogEntry } from '../types';
import AiDashboard from './AiDashboard';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const getLevelColor = (level: string) => {
    const l = level.toUpperCase();
    if (l.includes('ERROR') || l.includes('FATAL')) return '#ef4444';
    if (l.includes('WARN')) return '#f59e0b';
    if (l.includes('DEBUG')) return '#8b5cf6';
    if (l.includes('CRITICAL')) return '#7c3aed';
    return '#3b82f6';
};

const VisualAnalytics: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'classic' | 'pro'>('classic');

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                // Fetch a good amount of logs for visualization
                const data = await getHistoricalLogs(1000);
                setLogs(data);
            } catch (err: any) {
                console.error("Failed to fetch logs for visual analytics:", err);
                setError(err.message || "Failed to load log data");
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    // Classic View Aggregations (Non-Python)
    const stats = useMemo(() => {
        if (!logs.length) return { total: 0, meanScore: 0, anomalyDensity: 0 };
        const total = logs.length;
        const totalScore = logs.reduce((acc, log) => acc + (log.anomalyScore || 0), 0);
        const anomalies = logs.filter(log => (log.anomalyScore || 0) > 0.5 || log.level === 'FATAL').length;
        
        return {
            total,
            meanScore: (totalScore / total).toFixed(2),
            anomalyDensity: ((anomalies / total) * 100).toFixed(1)
        };
    }, [logs]);

    const levelData = useMemo(() => {
        const counts: any = {};
        logs.forEach(log => {
            const level = (log.level || 'INFO').toUpperCase();
            counts[level] = (counts[level] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [logs]);

    const temporalData = useMemo(() => {
        const hours: any = {};
        logs.forEach(log => {
            try {
                const hour = new Date(log.timestamp).getHours();
                const label = `${hour}:00`;
                hours[label] = (hours[label] || 0) + 1;
            } catch (e) {}
        });
        return Object.entries(hours)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (b.value as number) - (a.value as number))
            .slice(0, 6);
    }, [logs]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
                <p className="text-gray-500 animate-pulse font-medium">Preparing Visual Analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 space-y-4">
                <Icon name="exclamation-triangle" className="w-16 h-16 text-red-500 opacity-50" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Analytics Error</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md">{error}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Visual Analytics</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Comprehensive visualization and system analysis.
                    </p>
                </div>
                
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit border border-gray-200 dark:border-gray-700 shadow-inner">
                    <button
                        onClick={() => setViewMode('classic')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                            viewMode === 'classic' 
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        Classic View
                    </button>
                    <button
                        onClick={() => setViewMode('pro')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                            viewMode === 'pro' 
                            ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        <Icon name="sparkles" className="w-3.5 h-3.5" />
                        Pro AI View
                    </button>
                </div>
            </div>

            {viewMode === 'classic' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="p-8 border-2 border-primary/10 shadow-xl bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                                <Icon name="dashboard" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Operational Insights</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="p-6 bg-white/60 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm border-t-4 border-t-blue-500">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Events</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-gray-900 dark:text-white">{stats.total.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-blue-500">Analyzed</span>
                                </div>
                            </div>
                            <div className="p-6 bg-white/60 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm border-t-4 border-t-purple-500">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mean Anomaly Score</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-gray-900 dark:text-white">{stats.meanScore}</span>
                                    <span className="text-xs font-bold text-purple-500">Aggregated</span>
                                </div>
                            </div>
                            <div className="p-6 bg-white/60 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm border-t-4 border-t-amber-500">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Anomaly Density</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-gray-900 dark:text-white">{stats.anomalyDensity}%</span>
                                    <span className="text-xs font-bold text-amber-500">Flags</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="p-6 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md border-gray-100/50 dark:border-gray-700/50">
                                <h4 className="text-sm font-bold mb-6 text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    Level Distribution
                                </h4>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={levelData}>
                                            <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} />
                                            <YAxis fontSize={12} axisLine={false} tickLine={false} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                                {levelData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={getLevelColor(entry.name)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                            
                            <Card className="p-6 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md border-gray-100/50 dark:border-gray-700/50">
                                <h4 className="text-sm font-bold mb-6 text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                    Temporal Activity Hotspots
                                </h4>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={temporalData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {temporalData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AiDashboard logs={logs} />
                </div>
            )}
        </div>
    );
};

export default VisualAnalytics;
