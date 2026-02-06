import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Icon } from './ui/Icon';
import { API_BASE_URL } from '../utils/config';
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
        <p className="text-gray-500 text-xs">This usually happens when the AI service is under heavy load or spinning up on Render Free Tier.</p>        <div className="flex flex-col space-y-2">
            <a 
                href={`${API_BASE_URL}/ai/check-python`} 
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
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95 min-h-touch"
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
          <div className="h-64 md:h-80 flex items-center justify-center">
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
      {/* Bottom Row: Model Training */}
      <div className="mt-6 glass-card p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Icon name="brain" className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-200">Model Training Laboratory</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Hugging Face Integration</p>
                </div>
            </div>
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full font-bold">BETA</span>
        </div>
        
        {/* Loghub Dataset Loader */}
        <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/20">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="database" className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-300">Research Datasets (Loghub)</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">NEW</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Load industry-standard log datasets for benchmarking your anomaly detection models.</p>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={async () => {
                        const statusEl = document.getElementById('loghub-status');
                        if (statusEl) statusEl.innerHTML = '<span class="text-blue-400 animate-pulse">Loading HDFS dataset...</span>';                        try {
                            const res = await fetch(`${API_BASE_URL}/ai/load-dataset`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` },
                                body: JSON.stringify({ dataset_id: 'hdfs', max_samples: 2000 })
                            });
                            const data = await res.json();
                            if (res.ok && statusEl) {
                                statusEl.innerHTML = `<span class="text-green-400">✓ Loaded ${data.count} HDFS logs! Ready for training.</span>`;
                            } else if (statusEl) {
                                statusEl.innerHTML = `<span class="text-red-400">Error: ${data.error || 'Failed to load'}</span>`;
                            }
                        } catch (e: any) {
                            if (statusEl) statusEl.innerHTML = `<span class="text-red-400">Network error: ${e.message}</span>`;
                        }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                    Load HDFS (Hadoop)
                </button>
                <button
                    onClick={async () => {
                        const statusEl = document.getElementById('loghub-status');
                        if (statusEl) statusEl.innerHTML = '<span class="text-blue-400 animate-pulse">Loading BGL dataset...</span>';                        try {
                            const res = await fetch(`${API_BASE_URL}/ai/load-dataset`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` },
                                body: JSON.stringify({ dataset_id: 'bgl', max_samples: 2000 })
                            });
                            const data = await res.json();
                            if (res.ok && statusEl) {
                                statusEl.innerHTML = `<span class="text-green-400">✓ Loaded ${data.count} BGL logs! Ready for training.</span>`;
                            } else if (statusEl) {
                                statusEl.innerHTML = `<span class="text-red-400">Error: ${data.error || 'Failed to load'}</span>`;
                            }
                        } catch (e: any) {
                            if (statusEl) statusEl.innerHTML = `<span class="text-red-400">Network error: ${e.message}</span>`;
                        }
                    }}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                    Load BGL (BlueGene/L)
                </button>
            </div>
            <div id="loghub-status" className="mt-2 text-xs text-gray-500">Select a dataset to begin.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Model Architecture</label>
                    <input type="text" defaultValue="distilbert-base-uncased" id="hf-model-name" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. bert-base-uncased" />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Dataset</label>
                    <select id="hf-dataset-name" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none">
                        <option value="custom">Custom (Your Org Logs)</option>
                        <option value="hdfs">Loghub HDFS</option>
                        <option value="bgl">Loghub BGL</option>
                        <option value="imdb">IMDB (Demo)</option>
                    </select>
                </div>
                <button 
                    onClick={async () => {
                        const btn = document.getElementById('train-btn') as HTMLButtonElement;
                        const status = document.getElementById('train-status') as HTMLDivElement;
                        const modelName = (document.getElementById('hf-model-name') as HTMLInputElement).value;
                        const datasetName = (document.getElementById('hf-dataset-name') as HTMLSelectElement).value;
                        
                        if(btn) { btn.disabled = true; btn.innerText = 'Training...'; }
                        if(status) { status.innerText = 'Initializing training job...'; status.className = 'text-sm text-blue-400 animate-pulse'; }
                          try {
                            const res = await fetch(`${API_BASE_URL}/ai/train`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` },
                                body: JSON.stringify({ 
                                    model_type: 'huggingface', 
                                    model_name: modelName, 
                                    dataset_name: datasetName,
                                    logs: datasetName === 'custom' ? logs : []
                                })
                            });
                            const data = await res.json();
                            if(status) {
                                if(res.ok) {
                                    status.innerText = `Success! ${data.message}`;
                                    status.className = 'text-sm text-green-400';
                                } else {
                                    status.innerText = `Error: ${data.message || data.error}`;
                                    status.className = 'text-sm text-red-400';
                                }
                            }
                        } catch(e: any) {
                             if(status) { status.innerText = `Network Error: ${e.message}`; status.className = 'text-sm text-red-400'; }
                        } finally {
                            if(btn) { btn.disabled = false; btn.innerText = 'Start Training'; }
                        }
                    }}
                    id="train-btn"
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-purple-500/20"
                >
                    Start Training
                </button>
            </div>
            <div className="md:col-span-2 bg-black/20 rounded-xl p-4 font-mono text-xs text-gray-400 overflow-y-auto h-48 border border-gray-800" id="train-status">
                Ready to train. Select a model and dataset to begin fine-tuning.
            </div>
        </div>
      </div>

      {/* Model Playground */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Icon name="message-square" className="w-6 h-6 text-green-500" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-200">Model Playground</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Test Your Trained Model</p>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <textarea 
                    id="predict-input"
                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                    placeholder="Type a log message or sentence to test... (e.g. 'Database connection failed due to timeout')"
                ></textarea>
                <button 
                    onClick={async () => {
                        const input = (document.getElementById('predict-input') as HTMLTextAreaElement).value;
                        const resultDiv = document.getElementById('predict-result');
                        if(!input) return;
                        
                        if(resultDiv) {
                            resultDiv.innerHTML = '<span class="animate-pulse text-gray-400">Analyzing...</span>';
                        }                        try {
                            const res = await fetch(`${API_BASE_URL}/ai/predict_hf`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` },
                                body: JSON.stringify({ text: input })
                            });
                            const data = await res.json();
                            
                            if(resultDiv) {
                                if(res.ok) {
                                    const color = data.label === 'POSITIVE' ? 'text-green-400' : 'text-red-400';
                                    resultDiv.innerHTML = `
                                        <div class="text-center">
                                            <div class="text-3xl font-bold ${color} mb-1">${data.label}</div>
                                            <div class="text-xs text-gray-500">Confidence: ${(data.score * 100).toFixed(1)}%</div>
                                        </div>
                                    `;
                                } else {
                                    resultDiv.innerHTML = `<span class="text-red-400 text-sm">Error: ${data.error}</span>`;
                                }
                            }
                        } catch(e: any) {
                            if(resultDiv) resultDiv.innerHTML = `<span class="text-red-400 text-sm">Network Error</span>`;
                        }
                    }}
                    className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                >
                    Analyze Text
                </button>
            </div>
            <div className="flex items-center justify-center bg-black/20 rounded-xl border border-gray-800 min-h-[160px]" id="predict-result">
                <span className="text-gray-500 text-xs">Result will appear here</span>
            </div>
        </div>
      </div>

      {/* Kaggle Dataset Training */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Icon name="database" className="w-6 h-6 text-orange-500" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-gray-200">Kaggle Dataset Training</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Upload CSV & Train ML Models</p>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Upload CSV</label>
                    <input 
                        type="file" 
                        accept=".csv"
                        id="kaggle-csv-upload"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            const text = await file.text();
                            const lines = text.split('\n').filter(l => l.trim());
                            const headers = lines[0].split(',').map(h => h.trim());
                            
                            // Store in a global variable for training
                            (window as any).kaggleCsvData = text;
                            (window as any).kaggleHeaders = headers;
                            
                            // Update UI to show headers
                            const headersList = document.getElementById('kaggle-headers');
                            if (headersList) {
                                headersList.innerHTML = headers.map(h => 
                                    `<span class="px-2 py-1 bg-gray-700 rounded text-xs">${h}</span>`
                                ).join(' ');
                            }
                        }}
                    />
                </div>
                <div id="kaggle-headers" className="flex flex-wrap gap-2 min-h-[40px] items-center text-gray-500 text-xs">
                    Upload CSV to see columns...
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Target Column</label>
                    <input type="text" id="kaggle-target" placeholder="e.g., species, survived" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Feature Columns (comma-separated)</label>
                    <textarea id="kaggle-features" placeholder="e.g., sepal_length, sepal_width" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none" rows={3}></textarea>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Model Type</label>
                    <select id="kaggle-model-type" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                        <option value="random_forest">Random Forest</option>
                        <option value="logistic_regression">Logistic Regression</option>
                        <option value="svm">Support Vector Machine</option>
                    </select>
                </div>
                <button 
                    onClick={async () => {
                        const btn = document.getElementById('kaggle-train-btn') as HTMLButtonElement;
                        const status = document.getElementById('kaggle-status') as HTMLDivElement;
                        const csvData = (window as any).kaggleCsvData;
                        const target = (document.getElementById('kaggle-target') as HTMLInputElement).value;
                        const featuresText = (document.getElementById('kaggle-features') as HTMLTextAreaElement).value;
                        const modelType = (document.getElementById('kaggle-model-type') as HTMLSelectElement).value;
                        
                        if (!csvData || !target || !featuresText) {
                            alert('Please upload CSV and fill all fields');
                            return;
                        }
                        
                        const features = featuresText.split(',').map(f => f.trim());
                        
                        if(btn) { btn.disabled = true; btn.innerText = 'Training...'; }
                        if(status) { status.innerText = 'Training model...'; status.className = 'md:col-span-2 bg-black/20 rounded-xl p-4 font-mono text-xs text-blue-400 overflow-y-auto h-48 border border-gray-800 animate-pulse'; }
                          try {
                            const res = await fetch(`${API_BASE_URL}/ai/train-dataset`, {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
                                },
                                body: JSON.stringify({ 
                                    csv_data: csvData,
                                    target_column: target,
                                    feature_columns: features,
                                    model_type: modelType
                                })
                            });
                            
                            const data = await res.json();
                            
                            if(status) {
                                if(res.ok) {
                                    status.className = 'md:col-span-2 bg-black/20 rounded-xl p-4 font-mono text-xs text-gray-300 overflow-y-auto h-48 border border-gray-800';
                                    status.innerHTML = `
                                        <div class="space-y-2">
                                            <div class="text-green-400 font-bold">✓ ${data.message}</div>
                                            <div class="grid grid-cols-2 gap-2 mt-4">
                                                <div class="bg-green-500/10 p-2 rounded">
                                                    <div class="text-gray-500 text-[10px]">Accuracy</div>
                                                    <div class="text-green-400 text-lg font-bold">${(data.accuracy * 100).toFixed(1)}%</div>
                                                </div>
                                                <div class="bg-blue-500/10 p-2 rounded">
                                                    <div class="text-gray-500 text-[10px]">Precision</div>
                                                    <div class="text-blue-400 text-lg font-bold">${(data.precision * 100).toFixed(1)}%</div>
                                                </div>
                                                <div class="bg-yellow-500/10 p-2 rounded">
                                                    <div class="text-gray-500 text-[10px]">Recall</div>
                                                    <div class="text-yellow-400 text-lg font-bold">${(data.recall * 100).toFixed(1)}%</div>
                                                </div>
                                                <div class="bg-purple-500/10 p-2 rounded">
                                                    <div class="text-gray-500 text-[10px]">F1 Score</div>
                                                    <div class="text-purple-400 text-lg font-bold">${(data.f1_score * 100).toFixed(1)}%</div>
                                                </div>
                                            </div>
                                            <div class="text-gray-500 text-[10px] mt-4">
                                                Model: ${data.model_type} | Train: ${data.train_samples} | Test: ${data.test_samples}
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    status.innerText = `Error: ${data.error}`;
                                    status.className = 'md:col-span-2 bg-black/20 rounded-xl p-4 font-mono text-xs text-red-400 overflow-y-auto h-48 border border-gray-800';
                                }
                            }
                        } catch(e: any) {
                            if(status) { status.innerText = `Network Error: ${e.message}`; status.className = 'md:col-span-2 bg-black/20 rounded-xl p-4 font-mono text-xs text-red-400 overflow-y-auto h-48 border border-gray-800'; }
                        } finally {
                            if(btn) { btn.disabled = false; btn.innerText = 'Train Model'; }
                        }
                    }}
                    id="kaggle-train-btn"
                    className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-orange-500/20"
                >
                    Train Model
                </button>
            </div>
            <div id="kaggle-status" className="md:col-span-2 bg-black/20 rounded-xl p-4 font-mono text-xs text-gray-400 overflow-y-auto h-48 border border-gray-800">
                Ready to train. Upload a CSV file and configure the model.
                <div class="mt-4 text-[10px] text-gray-500">
                    <div class="font-bold mb-2">Example datasets to try:</div>
                    <ul class="list-disc list-inside space-y-1">
                        <li>Iris: sepal_length, sepal_width, petal_length, petal_width → species</li>
                        <li>Titanic: age, fare, pclass, sex → survived</li>
                        <li>Wine Quality: alcohol, pH, density → quality</li>
                    </ul>
                </div>
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
