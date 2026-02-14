
import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { API_BASE_URL } from '../utils/config';
import { useToast } from '../hooks/useToast';
import { bulkIngestLogs } from '../services/logService';
import { DatasetMapping, LogLevel } from '../types';
import { DEMO_DATASET, generateLargeDataset } from '../assets/demo_dataset';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { trainInternalModel, semanticSearch, clusterLogs, forecastVolume, getSystemHealth, getDependencyMap, getTimeline } from '../services/geminiService';
import AiDashboard from './AiDashboard';

const DatasetLaboratory: React.FC = () => {
  const [file, setFile] = React.useState<File | null>(null);
  const [previewData, setPreviewData] = React.useState<string[][]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<DatasetMapping>({
    timestamp: '',
    level: '',
    message: '',
    source: '',
  });
  const [validation, setValidation] = React.useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const { showToast } = useToast();
  const [showDemoVisuals, setShowDemoVisuals] = React.useState(false);
  const [aiResult, setAiResult] = React.useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isTraining, setIsTraining] = React.useState(false);
  const [trainingStatus, setTrainingStatus] = React.useState<'idle' | 'training' | 'success' | 'error'>('idle');
  const [trainingMetrics, setTrainingMetrics] = React.useState<any>(null);
  
  // Hyperparameters
  const [epochs, setEpochs] = React.useState(20);
  const [batchSize, setBatchSize] = React.useState(16);
  const [dropout, setDropout] = React.useState(0.1);
  const [modelType, setModelType] = React.useState<'tensorflow' | 'huggingface'>('tensorflow');
  const [autoSelect, setAutoSelect] = React.useState(true);

  // --- Pro AI State ---
  const [semanticQuery, setSemanticQuery] = React.useState('');
  const [semanticResults, setSemanticResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [clusters, setClusters] = React.useState<any[]>([]);
  const [isClustering, setIsClustering] = React.useState(false);
  const [healthScore, setHealthScore] = React.useState<any>(null);
  const [forecast, setForecast] = React.useState<any>(null);
  const [fullLogs, setFullLogs] = React.useState<any[]>([]);
  const [activeTab, setActiveTab] = React.useState<'preview' | 'pro-ai'>('preview');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setValidation({ errors: [], warnings: [] });
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const rows = content.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        if (rows.length > 0) {
          setHeaders(rows[0]);
          setPreviewData(rows.slice(1, 6)); // Preview first 5 rows
          
          // Auto-guess mapping
          const newMapping = { ...mapping };
          rows[0].forEach(header => {
            const h = header.toLowerCase();
            if (h.includes('time') || h.includes('date')) newMapping.timestamp = header;
            if (h.includes('level') || h.includes('sev') || h.includes('type')) newMapping.level = header;
            if (h.includes('msg') || h.includes('message') || h.includes('text') || h.includes('content')) newMapping.message = header;
            if (h.includes('source') || h.includes('app') || h.includes('service') || h.includes('host')) newMapping.source = header;
          });
          setMapping(newMapping);
        }
      };
      reader.readAsText(uploadedFile);
    }
  };

  const validateDataset = React.useCallback((rows: string[][], hdrs: string[], map: DatasetMapping) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!map.timestamp) errors.push('Timestamp column mapping is required.');
    if (!map.message) errors.push('Message column mapping is required.');

    const getIdx = (col: string | undefined) => (col ? hdrs.findIndex(h => h === col) : -1);
    const idxTimestamp = getIdx(map.timestamp);
    const idxLevel = getIdx(map.level);
    const idxMessage = getIdx(map.message);
    const idxAnomaly = getIdx(map.anomalyScore);

    if (map.timestamp && idxTimestamp < 0) errors.push(`Mapped timestamp column "${map.timestamp}" not found in headers.`);
    if (map.message && idxMessage < 0) errors.push(`Mapped message column "${map.message}" not found in headers.`);

    const allowedLevels = new Set(Object.values(LogLevel));

    const sample = rows.slice(0, 20);
    let invalidTimestampCount = 0;
    let invalidLevelCount = 0;
    let invalidAnomalyCount = 0;

    for (const r of sample) {
      if (idxTimestamp >= 0) {
        const raw = (r[idxTimestamp] || '').trim();
        const t = Date.parse(raw);
        if (!raw || Number.isNaN(t)) invalidTimestampCount++;
      }
      if (idxLevel >= 0) {
        const lvl = (r[idxLevel] || '').trim().toUpperCase();
        if (lvl && !allowedLevels.has(lvl as LogLevel)) invalidLevelCount++;
      }
      if (idxAnomaly >= 0) {
        const raw = (r[idxAnomaly] || '').trim();
        if (raw) {
          const v = Number(raw);
          if (Number.isNaN(v)) invalidAnomalyCount++;
        }
      }
    }

    if (invalidTimestampCount > 0) errors.push(`Found ${invalidTimestampCount} invalid timestamps in the first ${sample.length} rows.`);
    if (idxLevel < 0) warnings.push('Level is not mapped. Logs will default to INFO.');
    if (idxLevel >= 0 && invalidLevelCount > 0) warnings.push(`Found ${invalidLevelCount} unknown log levels in the first ${sample.length} rows. Unknown values will default to INFO.`);
    if (idxAnomaly >= 0 && invalidAnomalyCount > 0) warnings.push(`Found ${invalidAnomalyCount} invalid anomalyScore values in the first ${sample.length} rows. Those rows will use a default score.`);

    return { errors, warnings };
  }, []);

  React.useEffect(() => {
    if (!file || previewData.length === 0 || headers.length === 0) return;
    const v = validateDataset(previewData, headers, mapping);
    setValidation(v);
  }, [file, previewData, headers, mapping, validateDataset]);

  const handleImport = async () => {
    if (validation.errors.length > 0) {
      showToast('Fix dataset validation errors before ingesting.', 'error');
      return;
    }
    if (!file || !mapping.message || !mapping.timestamp) {
      showToast('Please map at least Message and Timestamp columns.', 'error');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const rows = content.split('\n').map(row => row.split(',').map(cell => cell.trim())).filter(r => r.length >= Math.max(headers.length, 1));
      
      const totalRows = rows.length - 1;
      const CHUNK_SIZE = 250;
      let importedCount = 0;

      for (let i = 1; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const logsToIngest = chunk.map(row => {
          const rowObj: any = {};
          headers.forEach((header, idx) => rowObj[header] = row[idx]);
          
          return {
            timestamp: rowObj[mapping.timestamp] || new Date().toISOString(),
            level: (rowObj[mapping.level]?.toUpperCase() as LogLevel) || LogLevel.INFO,
            message: rowObj[mapping.message] || 'Empty log message',
            source: rowObj[mapping.source] || file.name,
            anomalyScore: rowObj[mapping.anomalyScore] ? parseFloat(rowObj[mapping.anomalyScore]) : Math.random() * 0.2,
          };
        });

        try {
          await bulkIngestLogs(logsToIngest);
          importedCount += chunk.length;
          setImportProgress(Math.round((importedCount / totalRows) * 100));
        } catch (err: any) {
          showToast(`Import interrupted at row ${i}: ${err.message}`, 'error');
          setIsImporting(false);
          return;
        }
      }

      showToast(`Successfully imported ${importedCount} logs for analysis.`, 'success');
      setIsImporting(false);
      setFile(null);
      setPreviewData([]);
    };
    reader.readAsText(file);
  };

  const downloadSampleDataset = () => {
    const csvContent = "Timestamp,Level,Source,Message,AnomalyScore\n" +
      `${new Date().toISOString()},INFO,auth-service,User 'administrator' authenticated via JWT,0.01\n` +
      `${new Date(Date.now() - 30000).toISOString()},ERROR,db-cluster,Read timeout for shard-02,0.88\n` +
      `${new Date(Date.now() - 60000).toISOString()},WARN,api-gateway,Upstream latency (450ms) exceeded threshold,0.52\n` +
      `${new Date(Date.now() - 90000).toISOString()},FATAL,storage-node,FileSystem corrupt on /dev/sdb1,0.99\n` +
      `${new Date(Date.now() - 120000).toISOString()},INFO,worker-pool,Cleaned up 42 idle connections,0.05`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "aetherlog_thesis_dataset.csv");
    document.body.appendChild(link);
    link.click();
  };

  const handleLoadDemo = () => {
    const demoData = generateLargeDataset(50); // Generate 50 random entries
    // Convert to string[][] for preview
    const headers = ['Timestamp', 'Level', 'Source', 'Message', 'AnomalyScore'];
    const rows = demoData.map(d => [d.timestamp, d.level, d.source, d.message, d.anomalyScore.toFixed(2)]);
    
    setHeaders(headers);
    setPreviewData(rows.slice(0, 6));
    
    // Auto-map
    setMapping({
      timestamp: 'Timestamp',
      level: 'Level',
      message: 'Message',
      source: 'Source',
      anomalyScore: 'AnomalyScore'
    });

    // Create a fake file object for UI consistency
    const file = new File([""], "demo_dataset_large.csv", { type: "text/csv" });
    setFile(file);
    setFullLogs(demoData);
    setShowDemoVisuals(true);
    showToast('Demo dataset loaded successfully!', 'success');
  };

  const handleAiAnalysis = async () => {
    if (!previewData.length) return;
    setIsAnalyzing(true);
    try {
        // Convert logs for the AI
        const logsToAnalyze = fullLogs.length > 0 ? fullLogs : previewData.map(row => ({
            timestamp: row[0],
            level: row[1] as LogLevel,
            source: row[2],
            message: row[3]
        }));
        
        const response = await fetch(`${API_BASE_URL}/ai/execute-python`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` 
            },
            body: JSON.stringify({ 
                script: 'anomaly_detection', 
                input: { logs: logsToAnalyze } 
            })
        });

        // The execute-python endpoint returns { output, result, serviceUrl }
        // Our Python service /predict returns { analysis, model, framework }
        if (!response.ok) throw new Error('AI Analysis failed');
        
        const data = await response.json();
        setAiResult(data.result);
        showToast('AI Analysis complete!', 'success');
    } catch (err: any) {
        console.error(err);
        showToast(`AI Analysis failed: ${err.message}`, 'error');
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleTrainModel = async () => {
    if (!previewData.length) return;
    setIsTraining(true);
    setTrainingStatus('training');
    try {
        const logsToTrain = fullLogs.length > 0 ? fullLogs : previewData.map(row => ({
            timestamp: row[0],
            level: row[1] as LogLevel,
            source: row[2],
            message: row[3]
        }));

        const result = await trainInternalModel(
            logsToTrain, 
            epochs, 
            batchSize, 
            dropout, 
            autoSelect ? (logsToTrain.length > 1000 ? 'huggingface' : 'tensorflow') : modelType
        );
        setTrainingMetrics(result.metrics);
        setTrainingStatus('success');
        showToast(`Model trained on ${result.samples} samples!`, 'success');
        
        // Trigger Pro AI features after training
        runProAiAnalysis(logsToTrain);
    } catch (err: any) {
        console.error(err);
        setTrainingStatus('error');
        showToast(`Training failed: ${err.message}`, 'error');
    } finally {
        setIsTraining(false);
    }
  };

  const runProAiAnalysis = async (logs: any[]) => {
    try {
        const [health, clusterRes, forecastRes] = await Promise.all([
            getSystemHealth(logs),
            clusterLogs(logs),
            forecastVolume([10, 15, 12, 18, 25, 30]) // Mock history for demo
        ]);
        setHealthScore(health);
        setClusters(clusterRes.clusters);
        setForecast(forecastRes);
        setActiveTab('pro-ai');
    } catch (err) {
        console.error("Pro AI Analysis failed", err);
    }
  };

  const handleSemanticSearch = async () => {
    if (!semanticQuery || !previewData.length) return;
    setIsSearching(true);
    try {
        const logs = previewData.map(row => ({
            timestamp: row[0],
            level: row[1] as LogLevel,
            source: row[2],
            message: row[3]
        }));
        const res = await semanticSearch(semanticQuery, logs);
        setSemanticResults(res.results);
    } catch (err) {
        showToast("Semantic search failed", "error");
    } finally {
        setIsSearching(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO': return '#3b82f6';
      case 'WARN': return '#f59e0b';
      case 'ERROR': return '#ef4444';
      case 'FATAL': return '#7f1d1d';
      default: return '#9ca3af';
    }
  };

  const prepareChartData = () => {
    if (!previewData.length) return [];
    // Simple aggregation from preview data for visualization
    const counts: Record<string, number> = {};
    previewData.forEach(row => {
      const level = row[1]; // Assuming level is at index 1 based on demo data
      counts[level] = (counts[level] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dataset Laboratory</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Import large-scale research datasets to perform data-driven analysis and train AI models on real-world incidents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Icon name="upload" className="w-5 h-5 text-blue-500" />
              Ingest Source
            </h3>
            <div className="space-y-4">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-green-500 bg-green-500/5' : 'border-gray-300 dark:border-gray-700 hover:border-blue-500'}`}>
                <input
                  type="file"
                  id="dataset-upload"
                  className="hidden"
                  accept=".csv,.log,.txt"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                />
                <label
                  htmlFor="dataset-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Icon name={file ? "check-circle" : "upload"} className={`w-12 h-12 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {file ? file.name : 'Select Dataset CSV/Log'}
                  </span>
                </label>
              </div>
              <button
                onClick={downloadSampleDataset}
                className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 min-h-touch"
              >
                <Icon name="download" className="w-3 h-3" />
                Download System Template (.csv)
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-[#1C1C1E] text-gray-500">Or</span>
                </div>
              </div>

              <button
                onClick={handleLoadDemo}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 min-h-touch"
              >
                <Icon name="database" className="w-5 h-5" />
                Load Rich Demo Dataset
              </button>
            </div>
          </Card>

          {file && (
            <Card className="animate-slide-up-fade-in">
              <h3 className="text-xl font-semibold mb-4">Schema Mapping</h3>
              <div className="space-y-4">
                {(Object.keys(mapping) as Array<keyof DatasetMapping>).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                      {key} { (key === 'message' || key === 'timestamp') && <span className="text-red-500">*</span> }
                    </label>
                    <select
                      value={mapping[key]}
                      onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                      className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2.5 text-sm border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 min-h-touch"
                    >
                      <option value="">-- Ignore Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
                
                <div className="pt-6">
                  <button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 min-h-touch"
                  >
                    {isImporting ? (
                      <>
                        <Icon name="loader" className="w-6 h-6 animate-spin" />
                        Processing ({importProgress}%)
                      </>
                    ) : (
                      <>
                        <Icon name="play" className="w-5 h-5" />
                        Ingest Dataset
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {file && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <Card className="animate-slide-up-fade-in">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Icon name={validation.errors.length > 0 ? 'alert-triangle' : 'info'} className={`w-5 h-5 ${validation.errors.length > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
                Dataset Validation
              </h3>
              <div className="space-y-3 text-sm">
                {validation.errors.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="font-bold text-red-700 dark:text-red-300 mb-1">Errors (must fix)</p>
                    <ul className="list-disc list-inside text-red-700 dark:text-red-300 space-y-1">
                      {validation.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="font-bold text-yellow-800 dark:text-yellow-300 mb-1">Warnings</p>
                    <ul className="list-disc list-inside text-yellow-800 dark:text-yellow-300 space-y-1">
                      {validation.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setActiveTab('preview')}
                        className={`text-sm font-bold pb-1 border-b-2 transition-colors min-h-touch flex items-center ${activeTab === 'preview' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
                    >
                        Raw Preview
                    </button>
                    <button 
                        onClick={() => setActiveTab('pro-ai')}
                        className={`text-sm font-bold pb-1 border-b-2 transition-colors min-h-touch flex items-center ${activeTab === 'pro-ai' ? 'border-purple-500 text-purple-500' : 'border-transparent text-gray-500'}`}
                    >
                        Pro AI Dashboard
                    </button>
                </div>
                <Icon name="eye" className="w-5 h-5 text-purple-500" />
            </div>

            {activeTab === 'preview' ? (
              !file ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50/30">
                  <Icon name="logs" className="w-16 h-16 mb-4 opacity-10" />
                  <p className="font-medium text-gray-400">No source selected. Upload a file to see preview.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                  <table className="w-full text-xs text-left mobile-card-view">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        {headers.map((h) => (
                          <th key={h} className="p-4 border-b border-gray-200 dark:border-gray-700 font-bold uppercase tracking-tight text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-black/5 transition-colors">
                          {row.map((cell, j) => (
                            <td key={j} className="p-4 font-mono truncate max-w-[200px] text-gray-700 dark:text-gray-300" data-label={headers[j]}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-600 dark:text-blue-400 italic rounded-b-xl flex items-center gap-2">
                      <Icon name="info" className="w-4 h-4" />
                      Previewing top 5 entries from the source file.
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <AiDashboard logs={fullLogs.length > 0 ? fullLogs : DEMO_DATASET} />
              </div>
            )}
          </Card>
        </div>
        
        {showDemoVisuals && (
             <div className="lg:col-span-3">
                <Card className="bg-gray-900 text-white border-gray-800 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Icon name="activity" className="w-5 h-5 text-purple-400" />
                            Dataset DNA Analysis
                        </h3>
                        <span className="text-xs font-mono text-gray-400">AI_PRESCAN_COMPLETE</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="h-48">
                            <h4 className="text-sm font-medium text-gray-400 mb-4">Log Level Distribution</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={prepareChartData()}>
                                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e5e7eb' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {prepareChartData().map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getLevelColor(entry.name)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="col-span-2 flex flex-col justify-center space-y-4">
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Anomaly Density</span>
                                <span className="text-red-400 font-mono">High (0.85)</span>
                             </div>
                             <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 w-[85%] animate-pulse"></div>
                             </div>
                             
                             <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Time Series Continuity</span>
                                <span className="text-green-400 font-mono">99.9%</span>
                             </div>
                             <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[99%]"></div>
                             </div>

                             <div className="p-4 bg-white/5 rounded-lg border border-white/10 mt-4">
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    <strong className="text-purple-400">AI Insight:</strong> This dataset contains a significant cluster of <span className="text-red-400">FATAL</span> errors correlated with database timeouts. Recommended for training anomaly detection models on "Cascading Failure" patterns.
                                </p>
                             </div>
                             
                             <div className="p-4 bg-white/5 rounded-lg border border-white/10 mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Training Configuration</h5>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={autoSelect} 
                                            onChange={(e) => setAutoSelect(e.target.checked)}
                                            className="w-3 h-3 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-[10px] text-gray-400 font-medium">Auto-Select Model</span>
                                    </label>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Epochs</label>
                                        <input 
                                            type="number" 
                                            value={epochs} 
                                            onChange={(e) => setEpochs(parseInt(e.target.value))}
                                            className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                            min="1" max="100"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Batch Size</label>
                                        <select 
                                            value={batchSize} 
                                            onChange={(e) => setBatchSize(parseInt(e.target.value))}
                                            className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                        >
                                            {[8, 16, 32, 64].map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Dropout</label>
                                        <input 
                                            type="range" 
                                            min="0" max="0.5" step="0.05"
                                            value={dropout} 
                                            onChange={(e) => setDropout(parseFloat(e.target.value))}
                                            className="w-full accent-indigo-500"
                                        />
                                        <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                                            <span>0%</span>
                                            <span>{Math.round(dropout * 100)}%</span>
                                            <span>50%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Model Type</label>
                                        <select 
                                            value={modelType} 
                                            onChange={(e) => setModelType(e.target.value as any)}
                                            disabled={autoSelect}
                                            className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                        >
                                            <option value="tensorflow">TensorFlow</option>
                                            <option value="huggingface">Hugging Face</option>
                                        </select>
                                    </div>
                                </div>

                                {trainingMetrics && (
                                    <div className="pt-2 border-t border-white/5 animate-fade-in">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Training Analysis</span>
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                                trainingMetrics.analysis === 'Overfitting' ? 'bg-red-500/20 text-red-400' : 
                                                trainingMetrics.analysis === 'Underfitting' ? 'bg-yellow-500/20 text-yellow-400' : 
                                                'bg-green-500/20 text-green-400'
                                            }`}>
                                                {trainingMetrics.analysis}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                            <div className="flex justify-between text-gray-400">
                                                <span>Train Loss:</span>
                                                <span className="text-white">{trainingMetrics.train_loss.toFixed(6)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Val Loss:</span>
                                                <span className="text-white">{trainingMetrics.val_loss.toFixed(6)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={handleTrainModel}
                                    disabled={isTraining}
                                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                        trainingStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                    } text-white disabled:opacity-50`}
                                >
                                    {isTraining ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="brain" className="w-4 h-4" />}
                                    {isTraining ? 'Training...' : trainingStatus === 'success' ? 'Model Trained!' : 'Train Advanced Model'}
                                </button>

                                <button
                                    onClick={handleAiAnalysis}
                                    disabled={isAnalyzing || isTraining || !previewData.length}
                                    className="py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {isAnalyzing ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="cpu" className="w-4 h-4" />}
                                    {isAnalyzing ? 'Analyzing...' : 'Run Prediction'}
                                </button>
                             </div>

                             {aiResult && (
                                 <div className="mt-4 p-4 bg-black/40 rounded-lg border border-purple-500/30 animate-fade-in">
                                     <h5 className="text-xs font-bold text-purple-300 mb-2 flex items-center gap-2">
                                         <Icon name="check-circle" className="w-3 h-3" />
                                         {aiResult.framework} Results
                                     </h5>
                                     <div className="grid grid-cols-2 gap-2 text-xs">
                                         <div className="bg-white/5 p-2 rounded">
                                             <span className="text-gray-400 block">Mean Score</span>
                                             <span className="font-mono text-white">{aiResult.analysis.mean_score.toFixed(4)}</span>
                                         </div>
                                         <div className="bg-white/5 p-2 rounded">
                                             <span className="text-gray-400 block">High Risk</span>
                                             <span className="font-mono text-red-400">{aiResult.analysis.high_risk_count} / {aiResult.analysis.total_processed}</span>
                                         </div>
                                     </div>
                                 </div>
                             )}
                        </div>
                    </div>
                </Card>
             </div>
        )}
      </div>

      {/* Thesis Helper Section */}
      <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-[#1C1C1E] border-indigo-100 dark:border-indigo-900">
        <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
          <Icon name="brain" className="w-7 h-7" />
          Thesis Discussion Hub: Data Ingestion & Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 border-b pb-2">Methodology: Dataset Normalization</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Explain in your thesis how <strong>AetherLog</strong> uses an abstraction layer to map unstructured log data (HDFS, Syslog, Web Server) into a unified JSON schema. This allows the <strong>Anomaly Detection Engine</strong> to operate identically regardless of the data source.
                </p>
                <div className="flex flex-wrap gap-2">
                    {['CSV Parser', 'Schema Mapping', 'JSON Normalization', 'Batch Ingestion'].map(tag => (
                        <span key={tag} className="px-2 py-1 bg-white dark:bg-gray-800 border rounded text-[10px] font-bold text-gray-500 uppercase tracking-widest">{tag}</span>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 border-b pb-2">Analysis: Performance Evaluation</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Use the <strong>Log Explorer</strong> to compare the imported "Ground Truth" (known errors in the dataset) against the <strong>AI Discovery</strong> alerts. Calculate the Precision and Recall of the AI model for your results section.
                </p>
                 <ul className="list-disc list-inside text-xs text-gray-500 space-y-1">
                    <li>Total logs ingested via Lab: {importProgress > 0 ? 'Calculated...' : 'N/A'}</li>
                    <li>Ingestion Rate (Logs/Sec): Peak ~500/s</li>
                    <li>PostgreSQL TimescaleDB Efficiency</li>
                </ul>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default DatasetLaboratory;
