import * as React from 'react';
import { LogEntry, LogLevel, GeneratedFilters } from '../types';
import { useLogStream } from '../hooks/useLogStream';
import ExplainAnomalyModal from './ExplainAnomalyModal';
import { sources } from '../services/logService';
import { Icon } from './ui/Icon';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../hooks/useToast';
import { generateFiltersFromQuery, getApiKeyStatus } from '../services/geminiService';
import { useSearchParams, useNavigate } from 'react-router-dom';
import RootCauseAnalysisModal from './RootCauseAnalysisModal';
import AiPlaybookModal from './AiPlaybookModal';
import { AiChoiceDropdown } from './ui/AiChoiceDropdown';
import { soundNotificationService } from '../services/soundNotificationService';

type AiProvider = 'gemini' | 'openai' | 'python';

const LogLevelBadge: React.FC<{ level: LogLevel }> = ({ level }) => {
  const levelColorMap: Record<LogLevel, string> = {
    [LogLevel.INFO]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    [LogLevel.WARN]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    [LogLevel.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    [LogLevel.DEBUG]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    [LogLevel.FATAL]: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  };
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${levelColorMap[level]}`}>
      {level}
    </span>
  );
};

const AiQueryModal: React.FC<{ onClose: () => void, onApplyFilters: (filters: GeneratedFilters) => void, apiStatus: { geminiConfigured: boolean; openaiConfigured: boolean; } }> = ({ onClose, onApplyFilters, apiStatus }) => {
    const [query, setQuery] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const { showToast } = useToast();

    const handleGenerate = async (provider: AiProvider) => {
        if (!query.trim()) {
            showToast('Please enter a query.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const filters = await generateFiltersFromQuery(query, provider);
            onApplyFilters(filters);
            showToast('Filters generated and applied!', 'success');
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Failed to generate filters.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const aiChoices = [
        { label: 'Generate with OpenAI', provider: 'openai' as AiProvider, action: handleGenerate, disabled: !apiStatus.openaiConfigured, icon: 'sparkles' },
        { label: 'Generate with Gemini', provider: 'gemini' as AiProvider, action: handleGenerate, disabled: !apiStatus.geminiConfigured, icon: 'logo' },
        { label: 'Generate with Python AI', provider: 'python' as AiProvider, action: handleGenerate, disabled: false, icon: 'code' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-xl">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="sparkles" className="w-6 h-6" />
                        AI Query Builder
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <label htmlFor="ai-query" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Enter your query in plain English</label>
                    <textarea
                        id="ai-query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., show me all fatal errors from the auth-service containing 'Invalid credentials'"
                        className="w-full h-24 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg p-3 font-mono text-sm border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">The AI will parse your request and apply the corresponding filters for keyword, log level, and source.</p>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-black/20 rounded-b-2xl flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                        Cancel
                    </button>
                    <AiChoiceDropdown choices={aiChoices} isLoading={isLoading} onAction={handleGenerate}>
                       Generate & Apply
                    </AiChoiceDropdown>
                </div>
            </div>
        </div>
    );
};

const LiveAnomalies: React.FC = () => {
  const { anomalyThreshold } = useSettings();
  const [isPaused, setIsPaused] = React.useState(false);
  const { logs, isLoading: isStreamLoading } = useLogStream(!isPaused);
  const [selectedLog, setSelectedLog] = React.useState<{ log: LogEntry; provider: AiProvider } | null>(null);
  const [logForRca, setLogForRca] = React.useState<{ log: LogEntry; provider: AiProvider } | null>(null);
  const [logForPlaybook, setLogForPlaybook] = React.useState<{ log: LogEntry; provider: AiProvider } | null>(null);
  const logContainerRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Filter states
  const [selectedLevels, setSelectedLevels] = React.useState<Set<LogLevel>>(new Set());
  const [selectedSources, setSelectedSources] = React.useState<Set<string>>(new Set());
  const [keyword, setKeyword] = React.useState('');
  const [scoreRange, setScoreRange] = React.useState<[number, number]>([0, 1]);
  const [dateRange, setDateRange] = React.useState<{ start: string; end: string }>({ start: '', end: '' });
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = React.useState(false);
  const sourceDropdownRef = React.useRef<HTMLDivElement>(null);
  const [isAiQueryModalOpen, setIsAiQueryModalOpen] = React.useState(false);
  const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; }>({ geminiConfigured: false, openaiConfigured: false });


  React.useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  // Sound notification effect for new logs (WhatsApp-style)
  React.useEffect(() => {
    if (!isPaused && logs.length > 0) {
      const latestLog = logs[logs.length - 1];
      // Play WhatsApp-style sounds for high-severity logs
      if (latestLog.level === LogLevel.FATAL) {
        soundNotificationService.playSound('fatal');
      } else if (latestLog.level === LogLevel.ERROR) {
        soundNotificationService.playSound('critical');
      }
    }
  }, [logs, isPaused]);

  React.useEffect(() => {
    getApiKeyStatus().then(setApiStatus);
  }, []);

  // Effect to apply filters from URL
  React.useEffect(() => {
    const keywordParam = searchParams.get('keyword');
    const levelsParam = searchParams.get('levels');
    const sourcesParam = searchParams.get('sources');

    if (keywordParam) setKeyword(keywordParam);
    if (levelsParam) {
      const levels = levelsParam.split(',').filter(l => Object.values(LogLevel).includes(l as LogLevel)) as LogLevel[];
      setSelectedLevels(new Set(levels));
    }
    if (sourcesParam) {
      const validSources = sourcesParam.split(',').filter(s => sources.includes(s));
      setSelectedSources(new Set(validSources));
    }
    
    // Clear params after applying so they don't stick on refresh
    if(keywordParam || levelsParam || sourcesParam) setSearchParams({});
  }, [searchParams, setSearchParams]);
  
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setIsSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels(prev => {
        const newSet = new Set(prev);
        if (newSet.has(level)) newSet.delete(level);
        else newSet.add(level);
        return newSet;
    });
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(source)) newSet.delete(source);
      else newSet.add(source);
      return newSet;
    });
  };

  const handleApplyAiFilters = (filters: GeneratedFilters) => {
    setKeyword(filters.keyword || '');
    setSelectedLevels(new Set(filters.levels || []));
    setSelectedSources(new Set(filters.sources || []));
  };
  
  const filteredLogs = React.useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs.filter(log => {
      if (!log) return false;
      if (selectedLevels.size > 0 && !selectedLevels.has(log.level)) return false;
      if (selectedSources.size > 0 && !selectedSources.has(log.source)) return false;
      if (keyword && !log.message?.toLowerCase().includes(keyword.toLowerCase())) return false;
      if ((log.anomalyScore ?? 0) < scoreRange[0] || (log.anomalyScore ?? 0) > scoreRange[1]) return false;
      if (dateRange.start && new Date(log.timestamp) < new Date(dateRange.start)) return false;
      if (dateRange.end && new Date(log.timestamp) > new Date(dateRange.end)) return false;
      return true;
    }).filter(log => (log.anomalyScore ?? 0) >= anomalyThreshold);
  }, [logs, selectedLevels, selectedSources, keyword, scoreRange, dateRange, anomalyThreshold]);

  const levelColorMap: Record<LogLevel, { text: string; darkText: string; bg: string; border: string; darkBorder: string; hover: string; darkHover: string; selected: string }> = {
    [LogLevel.INFO]: { text: 'text-blue-700', darkText: 'dark:text-blue-300', bg: 'bg-blue-500', border: 'border-blue-500', darkBorder: 'dark:border-blue-500', hover: 'hover:bg-blue-50', darkHover: 'dark:hover:bg-blue-500/20', selected: 'bg-blue-500 text-white' },
    [LogLevel.WARN]: { text: 'text-yellow-700', darkText: 'dark:text-yellow-300', bg: 'bg-yellow-500', border: 'border-yellow-500', darkBorder: 'dark:border-yellow-500', hover: 'hover:bg-yellow-50', darkHover: 'dark:hover:bg-yellow-500/20', selected: 'bg-yellow-500 text-white' },
    [LogLevel.ERROR]: { text: 'text-red-700', darkText: 'dark:text-red-300', bg: 'bg-red-500', border: 'border-red-500', darkBorder: 'dark:border-red-500', hover: 'hover:bg-red-50', darkHover: 'dark:hover:bg-red-500/20', selected: 'bg-red-500 text-white' },
    [LogLevel.DEBUG]: { text: 'text-gray-700', darkText: 'dark:text-gray-300', bg: 'bg-gray-500', border: 'border-gray-500', darkBorder: 'dark:border-gray-500', hover: 'hover:bg-gray-100', darkHover: 'dark:hover:bg-gray-500/20', selected: 'bg-gray-500 text-white' },
    [LogLevel.FATAL]: { text: 'text-purple-700', darkText: 'dark:text-purple-300', bg: 'bg-purple-500', border: 'border-purple-500', darkBorder: 'dark:border-purple-500', hover: 'hover:bg-purple-50', darkHover: 'dark:hover:bg-purple-500/20', selected: 'bg-purple-500 text-white' },
  };
  
  const handleDiscussWithAi = (log: LogEntry, provider: AiProvider) => {
    navigate('/ai-chat', {
      state: {
        initialMessage: `Tell me more about this log entry: "${log.message}" from source "${log.source}". What are the potential implications?`,
        provider: provider,
      },
    });
  };

   const playbookChoices: any[] = [
        { label: 'Generate with OpenAI', provider: 'openai', icon: 'sparkles', disabled: !apiStatus.openaiConfigured },
        { label: 'Generate with Gemini', provider: 'gemini', icon: 'logo', disabled: !apiStatus.geminiConfigured },
        { label: 'Generate with Python AI', provider: 'python', icon: 'code', disabled: false },
    ];
  const explainChoices: any[] = [
        { label: 'Explain with OpenAI', provider: 'openai', icon: 'sparkles', disabled: !apiStatus.openaiConfigured },
        { label: 'Explain with Gemini', provider: 'gemini', icon: 'logo', disabled: !apiStatus.geminiConfigured },
        { label: 'Explain with Python AI', provider: 'python', icon: 'code', disabled: false },
    ];
    const rcaChoices: any[] = [
        { label: 'Analyze with OpenAI', provider: 'openai', icon: 'sparkles', disabled: !apiStatus.openaiConfigured },
        { label: 'Analyze with Gemini', provider: 'gemini', icon: 'logo', disabled: !apiStatus.geminiConfigured },
        { label: 'Analyze with Python AI', provider: 'python', icon: 'code', disabled: false },
    ];
    const discussChoices: any[] = [
        { label: 'Discuss with OpenAI', provider: 'openai', icon: 'sparkles', disabled: !apiStatus.openaiConfigured },
        { label: 'Discuss with Gemini', provider: 'gemini', icon: 'logo', disabled: !apiStatus.geminiConfigured },
        { label: 'Discuss with Python AI', provider: 'python', icon: 'code', disabled: false },
    ];


  return (
    <div className="flex flex-col h-full">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Live Anomalies</h2>

      {/* Filter bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 p-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="lg:col-span-1">
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Search & Filter</label>
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input type="text" placeholder="Keyword..." value={keyword} onChange={e => setKeyword(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500"/>
                </div>
                 <button onClick={() => setIsAiQueryModalOpen(true)} title="AI Query" className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-300 font-semibold transition-colors min-w-touch min-h-touch">
                    <Icon name="sparkles" className="w-5 h-5" />
                </button>
            </div>
        </div>
        <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Log Level</label>
            <div className="flex flex-wrap gap-1">
                {(Object.values(LogLevel) as LogLevel[]).map(level => {
                    const colors = levelColorMap[level as LogLevel];
                    const isSelected = selectedLevels.has(level);
                    return (
                        <button key={level} onClick={() => toggleLevel(level)} className={`px-3 py-2 text-sm font-bold rounded-full border transition-colors min-h-touch flex items-center justify-center ${isSelected ? colors.selected : `bg-transparent ${colors.border} ${colors.darkBorder} ${colors.text} ${colors.darkText} ${colors.hover} ${colors.darkHover}`}`}>
                            {level}
                        </button>
                    )
                })}
            </div>
        </div>
        <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Source</label>
            <div className="relative" ref={sourceDropdownRef}>
                <button onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)} className="w-full flex justify-between items-center bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 min-h-touch">
                    <span>{selectedSources.size > 0 ? `${selectedSources.size} selected` : 'All Sources'}</span>
                    <Icon name="chevron-down" className={`w-5 h-5 transition-transform ${isSourceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isSourceDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg z-10 max-h-48 overflow-y-auto shadow-lg">
                        {sources.map(source => (
                            <label key={source} className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <input type="checkbox" checked={selectedSources.has(source)} onChange={() => toggleSource(source)} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-blue-500 focus:ring-blue-500" />
                                <span className="ml-3 text-sm font-mono text-gray-800 dark:text-gray-200">{source}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
        <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Anomaly Score: {scoreRange[0].toFixed(2)} - {scoreRange[1].toFixed(2)}</label>
            <div className="h-10 flex items-center">
                <input type="range" min="0" max="1" step="0.05" value={scoreRange[1]} onChange={e => setScoreRange([scoreRange[0], parseFloat(e.target.value)])} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer" />
            </div>
        </div>
    </div>
      

      <div className="flex-1 flex flex-col bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-black/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Log Stream</h3>
          <div className="flex gap-2">
            <button
                onClick={() => soundNotificationService.testSound('fatal')}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300"
                title="Test Fatal Error Sound"
            >
                <Icon name="volume-2" className="w-4 h-4" />
                Test Sound
            </button>
            <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200`}
            >
                <Icon name={isPaused ? 'play' : 'pause'} className="w-4 h-4" />
                {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>
        <div ref={logContainerRef} className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-2">
          {isStreamLoading && logs.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">Connecting to log stream...</div>
          )}
          {filteredLogs.map((log) => {
            const isFatal = log.level === LogLevel.FATAL;
            const rowStyle = isFatal 
              ? 'bg-red-500/10 animate-pulsate' 
              : (log.anomalyScore ?? 0) > 0.8 
              ? 'bg-red-500/10' 
              : (log.anomalyScore ?? 0) > 0.5 
              ? 'bg-yellow-500/10' 
              : 'bg-black/5 dark:bg-white/5';

            return (
            <div
              key={log.id}
              className={`p-3 rounded-lg flex items-start flex-wrap gap-x-4 gap-y-2 ${rowStyle}`}
            >
              <div className="w-40 text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</div>
              <div className="w-24 flex-shrink-0"><LogLevelBadge level={log.level} /></div>
              <div className="w-40 text-sky-600 dark:text-sky-400 flex-shrink-0">{log.source}</div>
              <div className="flex-1 text-gray-800 dark:text-gray-200 break-words min-w-[200px]">{log.message}</div>
              <div className="w-20 text-right font-semibold text-red-600 dark:text-red-400 flex-shrink-0">{(log.anomalyScore ?? 0).toFixed(2)}</div>
              <div className="flex items-center gap-2 ml-auto">
                {isFatal && (
                    <AiChoiceDropdown
                        choices={playbookChoices}
                        onAction={(provider) => setLogForPlaybook({ log, provider })}
                        size="sm"
                    >
                        Generate Playbook
                    </AiChoiceDropdown>
                )}
                <AiChoiceDropdown 
                    choices={discussChoices}
                    onAction={(provider) => handleDiscussWithAi(log, provider)}
                    size="sm"
                >
                    Discuss
                </AiChoiceDropdown>
                {isFatal && (
                     <AiChoiceDropdown 
                        choices={rcaChoices}
                        onAction={(provider) => setLogForRca({ log, provider })}
                        size="sm"
                    >
                        Analyze Cause
                    </AiChoiceDropdown>
                )}
                 <AiChoiceDropdown 
                    choices={explainChoices}
                    onAction={(provider) => setSelectedLog({ log, provider })}
                    size="sm"
                >
                    Explain
                </AiChoiceDropdown>
              </div>
            </div>
          )})}
          {isPaused && (
             <div className="text-center py-4 text-gray-500 dark:text-gray-400 sticky bottom-0">-- Log stream is paused --</div>
          )}
        </div>
      </div>
      {selectedLog && <ExplainAnomalyModal logEntry={selectedLog.log} provider={selectedLog.provider} onClose={() => setSelectedLog(null)} />}
      {isAiQueryModalOpen && <AiQueryModal onClose={() => setIsAiQueryModalOpen(false)} onApplyFilters={handleApplyAiFilters} apiStatus={apiStatus}/>}
      {logForRca && (
        <RootCauseAnalysisModal 
            targetLog={logForRca.log}
            provider={logForRca.provider}
            logHistory={logs.slice(0, logs.findIndex(l => l.id === logForRca.log.id))}
            onClose={() => setLogForRca(null)} 
        />
      )}
      {logForPlaybook && (
        <AiPlaybookModal
            targetLog={logForPlaybook.log}
            provider={logForPlaybook.provider}
            onClose={() => setLogForPlaybook(null)}
        />
      )}
    </div>
  );
};

export default LiveAnomalies;