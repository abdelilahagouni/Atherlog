import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Icon } from './ui/Icon';
import { getSystemHealth, getDependencyMap, getTimeline, clusterLogs } from '../services/geminiService';
import { LogEntry } from '../types';

interface AiDashboardProps {
  logs: LogEntry[];
}

const AiDashboard: React.FC<AiDashboardProps> = ({ logs }) => {
  const [health, setHealth] = useState<any>(null);
  const [dependencyMap, setDependencyMap] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [error, setError] = useState<{ message: string; code?: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!logs || logs.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [healthData, depData, timelineData, clusterData] = await Promise.all([
          getSystemHealth(logs),
          getDependencyMap(logs),
          getTimeline(logs),
          clusterLogs(logs)
        ]);
        
        // Defensive checks for data types
        setHealth(healthData && typeof healthData === 'object' ? healthData : { score: 0, status: 'Unknown' });
        setDependencyMap(depData && depData.nodes ? depData : { nodes: [], links: [] });
        setTimeline(Array.isArray(timelineData) ? timelineData : []);
        setClusters(clusterData && Array.isArray(clusterData.clusters) ? clusterData.clusters : []);
      } catch (err: any) {
        console.error("Failed to fetch dashboard data:", err);
        setError({
          message: err.message || "Failed to load AI insights",
          code: err.code,
          hint: err.hint
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [logs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 animate-pulse">Synthesizing AI Insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 text-center p-6">
        <Icon name="alert-circle" className="w-16 h-16 text-red-500 opacity-50" />
        <h3 className="text-xl font-bold text-gray-200">Analysis Failed</h3>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 max-w-md">
            <p className="text-red-400 text-sm font-mono">{error.message}</p>
            {error.code && <p className="text-red-300/60 text-[10px] mt-2 font-mono">Error Code: {error.code}</p>}
            {error.hint && <p className="text-gray-400 text-[10px] mt-1 italic">{error.hint}</p>}
        </div>
        <p className="text-gray-500 text-xs">This usually happens when the AI service is under heavy load or spinning up on Render Free Tier.</p>
        <div className="flex flex-col space-y-2">
            <a 
                href="/api/ai/check-python" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 text-[10px] hover:underline"
            >
                Verify Backend-to-Python Connectivity ↗
            </a>
            {error.error && <p className="text-red-300/40 text-[9px] font-mono max-w-xs truncate">Raw: {error.error}</p>}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 text-center">
        <Icon name="database" className="w-16 h-16 text-gray-600 opacity-20" />
        <h3 className="text-xl font-bold text-gray-400">No Data for Analysis</h3>
        <p className="text-gray-500 max-w-md">Please import a dataset in the Laboratory to generate AI insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Row: Health & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icon name="activity" className="w-24 h-24 text-blue-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Proactive Health Score</h3>
          <div className="flex items-end space-x-2">
            <span className={`text-5xl font-bold ${health?.score > 80 ? 'text-green-400' : health?.score > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {health?.score}%
            </span>
            <span className="text-sm text-gray-500 mb-2">System Stability</span>
          </div>
          <div className="mt-4 w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${health?.score > 80 ? 'bg-green-500' : health?.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${health?.score}%` }}
            ></div>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Status: <span className="font-semibold text-gray-200">{health?.status}</span>
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl md:col-span-2">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Incident Timeline (24h)</h3>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Middle Row: Clusters & Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-medium text-gray-400">Log Hotspots (Clusters)</h3>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">AI Grouped</span>
          </div>
          <div className="space-y-4">
            {clusters.slice(0, 4).map((cluster, idx) => (
              <div key={idx} className="flex items-center space-x-4 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-blue-400 font-bold">
                  {cluster.count}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate font-mono">{cluster.sample}</p>
                  <p className="text-xs text-gray-500">Pattern frequency: {Math.round((cluster.count / logs.length) * 100)}%</p>
                </div>
                <Icon name="chevron-right" className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <h3 className="text-sm font-medium text-gray-400 mb-6">Service Dependency Map</h3>
          <div className="h-64 flex items-center justify-center">
            {/* Simple SVG Graph for Dependency Map */}
            <svg width="100%" height="100%" viewBox="0 0 400 250">
              {dependencyMap?.links.map((link: any, i: number) => {
                const sourceIdx = dependencyMap.nodes.findIndex((n: any) => n.id === link.source);
                const targetIdx = dependencyMap.nodes.findIndex((n: any) => n.id === link.target);
                const x1 = 50 + (sourceIdx % 3) * 150;
                const y1 = 50 + Math.floor(sourceIdx / 3) * 100;
                const x2 = 50 + (targetIdx % 3) * 150;
                const y2 = 50 + Math.floor(targetIdx / 3) * 100;
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#444" strokeWidth="1" strokeDasharray="4" />
                );
              })}
              {dependencyMap?.nodes.map((node: any, i: number) => {
                const x = 50 + (i % 3) * 150;
                const y = 50 + Math.floor(i / 3) * 100;
                return (
                  <g key={i} className="animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
                    <circle cx={x} cy={y} r="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                    <text x={x} y={y + 35} textAnchor="middle" fill="#94a3b8" fontSize="10">{node.id}</text>
                    <circle cx={x} cy={y} r="4" fill="#10b981" className="animate-pulse" />
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="absolute bottom-4 right-4 flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Live Topology</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-xs font-bold text-blue-400">{payload[0].payload.time}</p>
        <p className="text-lg font-bold">{payload[0].value} Events</p>
        {payload[0].payload.isAnomaly && (
          <p className="text-[10px] text-red-400 mt-1 flex items-center">
            <Icon name="alert-triangle" className="w-3 h-3 mr-1" /> Anomaly Detected
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default AiDashboard;
