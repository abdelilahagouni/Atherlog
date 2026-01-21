import * as React from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { LogEntry, LogLevel, LogFilter, SavedSearch, GeneratedFilters } from '../types';
import { exploreLogs, getLogHistogram } from '../services/logService';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import LogEntryDetail from './LogEntryDetail';
import { getSavedSearches, createSavedSearch, deleteSavedSearch } from '../services/savedSearchService';
import { Card } from './ui/Card';
import { AiChoiceDropdown } from './ui/AiChoiceDropdown';
import { generateFiltersFromQuery, getApiKeyStatus } from '../services/geminiService';

const LogLevelBadge: React.FC<{ level: LogLevel }> = ({ level }) => {
  const levelColorMap: Record<LogLevel, string> = {
    [LogLevel.INFO]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    [LogLevel.WARN]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    [LogLevel.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    [LogLevel.DEBUG]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    [LogLevel.FATAL]: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  };
  return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${levelColorMap[level]}`}>{level}</span>;
};

type AiProvider = 'gemini' | 'openai';

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
                        <Icon name="x-circle" className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6">
                    <label htmlFor="ai-query" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Enter your query in plain English</label>
                    <textarea
                        id="ai-query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., find all leaked emails from domain 'example.com' linked to 'password123'"
                        className="w-full h-24 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg p-3 font-mono text-sm border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">The AI will parse your request and apply the corresponding filters for keyword, data type, and source.</p>
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


const GlobalSearch: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [logs, setLogs] = React.useState<LogEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [pagination, setPagination] = React.useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
    const [histogramData, setHistogramData] = React.useState<{ time: string; count: number }[]>([]);
    
    // Filter states
    const [query, setQuery] = React.useState(searchParams.get('query') || '');
    const [timeRange, setTimeRange] = React.useState({ start: searchParams.get('startDate') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16), end: searchParams.get('endDate') || new Date().toISOString().slice(0, 16) });
    const [selectedLevels, setSelectedLevels] = React.useState<Set<LogLevel>>(() => {
        const levelsParam = searchParams.get('levels');
        if (!levelsParam) return new Set();
        const validLevels = levelsParam.split(',').filter((l): l is LogLevel =>
            Object.values(LogLevel).includes(l as LogLevel)
        );
        return new Set(validLevels);
    });
    const [selectedSources, setSelectedSources] = React.useState<Set<string>>(() => {
        const sourcesParam = searchParams.get('sources');
        if (!sourcesParam) return new Set();
        return new Set(sourcesParam.split(',').filter(Boolean));
    });
    const [facetFilters, setFacetFilters] = React.useState<LogFilter[]>([]);
    
    const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);
    const [savedSearches, setSavedSearches] = React.useState<SavedSearch[]>([]);
    const [newSearchName, setNewSearchName] = React.useState('');
    const [isAiQueryModalOpen, setIsAiQueryModalOpen] = React.useState(false);
    const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; }>({ geminiConfigured: false, openaiConfigured: false });

    const { showToast } = useToast();
    const { theme } = useTheme();

    React.useEffect(() => {
        if (location.state?.openAiQuery) {
            setIsAiQueryModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    const fetchLogs = React.useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const levelArray = Array.from(selectedLevels);
            const sourceArray = Array.from(selectedSources);

            const [logData, histData] = await Promise.all([
                exploreLogs({
                    query: query || undefined,
                    startDate: timeRange.start || undefined,
                    endDate: timeRange.end || undefined,
                    levels: levelArray as string[],
                    sources: sourceArray as string[],
                    page,
                    limit: pagination.limit,
                    facetFilters: facetFilters,
                }),
                getLogHistogram({
                    query: query || undefined,
                    startDate: timeRange.start,
                    endDate: timeRange.end,
                    levels: levelArray as string[],
                    sources: sourceArray as string[],
                })
            ]);

            setLogs(logData.logs);
            setPagination(logData.pagination);
            setHistogramData(histData);

        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [query, timeRange, selectedLevels, selectedSources, facetFilters, pagination.limit, showToast]);

     React.useEffect(() => {
        const debounce = setTimeout(() => {
            fetchLogs(1);
        }, 500);
        return () => clearTimeout(debounce);
    }, [query, timeRange, selectedLevels, selectedSources, facetFilters, fetchLogs]);

    React.useEffect(() => {
        getApiKeyStatus().then(setApiStatus);
        getSavedSearches().then(setSavedSearches).catch(err => showToast(err.message, 'error'));
    }, [showToast]);

    const handleSearch = () => {
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 for new search
        fetchLogs(1);
    };

    const addFilter = (filter: LogFilter) => {
        if (!facetFilters.some(f => f.key === filter.key && f.value === filter.value)) {
            setFacetFilters(prev => [...prev, filter]);
        }
    };
    
    const removeFilter = (filterToRemove: LogFilter) => {
        setFacetFilters(prev => prev.filter(f => !(f.key === filterToRemove.key && f.value === filterToRemove.value)));
    };
    
    const handleSaveSearch = async () => {
        if (!newSearchName.trim()) {
            showToast('Please enter a name for the search.', 'error');
            return;
        }
        try {
            const newSearch = await createSavedSearch(newSearchName, {
                query, startDate: timeRange.start, endDate: timeRange.end, levels: [...selectedLevels], sources: [...selectedSources]
            });
            setSavedSearches(prev => [newSearch, ...prev]);
            setNewSearchName('');
            showToast('Search saved successfully!', 'success');
        } catch(err: any) {
            showToast(err.message, 'error');
        }
    };
    
    const applySavedSearch = (search: SavedSearch) => {
        setQuery(search.query?.query || '');
        setTimeRange({start: search.query?.startDate || '', end: search.query?.endDate || ''});
        const validLevels = (search.query?.levels || [])
            .filter((l): l is LogLevel => 
                typeof l === 'string' && Object.values(LogLevel).includes(l as LogLevel)
            );
        setSelectedLevels(new Set(validLevels));
        
        const validSources = (search.query?.sources || []).filter(s => typeof s === 'string');
        setSelectedSources(new Set(validSources));

        handleSearch(); // Trigger search immediately
    };
    
    const handleApplyAiFilters = (filters: GeneratedFilters) => {
        setQuery(filters.keyword || '');
        setSelectedLevels(new Set(filters.levels || []));
        setSelectedSources(new Set(filters.sources || []));
    };

    const handleDeleteSearch = async (searchId: string) => {
        try {
            await deleteSavedSearch(searchId);
            setSavedSearches(prev => prev.filter(s => s.id !== searchId));
            showToast('Saved search deleted.', 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };
    
    const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
    const tooltipBg = theme === 'dark' ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)';
    
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Global Search (6.6B+ Records)</h2>

        {/* Filter Bar */}
        <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Search Query</label>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by email, phone, IP, domain, or hash..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600"
                            />
                        </div>
                         <button onClick={() => setIsAiQueryModalOpen(true)} title="AI Query" className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-300 font-semibold transition-colors">
                            <Icon name="sparkles" className="w-5 h-5" />
                        </button>
                    </div>
                     {facetFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {facetFilters.map((filter, index) => (
                                <div key={index} className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full px-2.5 py-1 text-xs font-medium animate-fade-in">
                                    <span className="font-mono">{filter.key}: {filter.value}</span>
                                    <button onClick={() => removeFilter(filter)} className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100">
                                        <Icon name="x-circle" className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Start Time</label>
                    <input type="datetime-local" value={timeRange.start} onChange={e => setTimeRange(p => ({ ...p, start: e.target.value }))} className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600" />
                </div>
                <div>
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">End Time</label>
                    <input type="datetime-local" value={timeRange.end} onChange={e => setTimeRange(p => ({ ...p, end: e.target.value }))} className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600" />
                </div>
                <div className="flex items-end">
                     <button onClick={handleSearch} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2" title="Run Search">
                        <Icon name="search" className="w-5 h-5" />
                        Search
                    </button>
                </div>
            </div>
        </Card>
        
        {/* Saved Searches */}
        <Card>
            <h3 className="text-lg font-semibold mb-2">Saved Investigations</h3>
            <div className="flex flex-wrap gap-2 mb-2">
                {savedSearches.map(s => (
                    <div key={s.id} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <button onClick={() => applySavedSearch(s)} className="px-3 py-1 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-full">{s.name}</button>
                        <button onClick={() => handleDeleteSearch(s.id)} className="px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-r-full"><Icon name="trash" className="w-4 h-4 text-red-500"/></button>
                    </div>
                ))}
            </div>
             <div className="flex gap-2 items-center">
                <input value={newSearchName} onChange={e => setNewSearchName(e.target.value)} placeholder="Save current search as..." className="flex-grow bg-gray-50 dark:bg-gray-800 rounded p-1 text-sm" />
                <button onClick={handleSaveSearch} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Save</button>
            </div>
        </Card>

        {/* Histogram */}
        {histogramData.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Activity Volume</h3>
              <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                          <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} stroke={textColor} tick={{fontSize: 10}}/>
                          <YAxis stroke={textColor} tick={{fontSize: 10}} allowDecimals={false}/>
                          <Tooltip contentStyle={{ background: tooltipBg, border: 'none', borderRadius: '0.5rem' }} labelStyle={{ color: textColor }} />
                          <Bar dataKey="count" fill={theme === 'dark' ? '#3b82f6' : '#60a5fa'} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
            </Card>
        )}

        {/* Log Table */}
        <Card>
            <div className="overflow-x-auto">
                <table className="w-full text-sm mobile-card-view">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="text-left p-2 w-8"></th>
                            <th className="text-left p-2 w-48">Timestamp</th>
                            <th className="text-left p-2 w-24">Type</th>
                            <th className="text-left p-2 w-40">Source</th>
                            <th className="text-left p-2">Data</th>
                        </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center p-8"><Icon name="loader" className="w-8 h-8 animate-spin mx-auto"/></td></tr>
                        ) : logs.map(log => (
                            <React.Fragment key={log.id}>
                                <tr onClick={() => setExpandedLogId(log.id === expandedLogId ? null : log.id)} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                                    <td className="p-3 text-center" data-label="Expand"><Icon name="chevron-down" className={`w-4 h-4 transition-transform ${log.id === expandedLogId ? 'rotate-180' : ''}`}/></td>
                                    <td className="p-3 text-gray-500 dark:text-gray-400 whitespace-nowrap" data-label="Timestamp">{new Date(log.timestamp).toISOString()}</td>
                                    <td className="p-3" data-label="Level"><LogLevelBadge level={log.level}/></td>
                                    <td className="p-3 text-sky-600 dark:text-sky-400" data-label="Source">{log.source}</td>
                                    <td className="p-3 text-gray-800 dark:text-gray-200 truncate max-w-lg" data-label="Message">{log.message}</td>
                                </tr>
                                {log.id === expandedLogId && (
                                    <tr className="bg-gray-100 dark:bg-gray-800">
                                        <td colSpan={5} className="p-4">
                                            <LogEntryDetail log={log} onAddFilter={addFilter} />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                         { !loading && logs.length === 0 && <tr><td colSpan={5} className="text-center p-8 text-gray-500">No records found for the selected criteria.</td></tr>}
                    </tbody>
                </table>
            </div>
             <div className="flex justify-between items-center mt-4 text-sm p-4">
                <p>Showing page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total records)</p>
                <div className="flex gap-2">
                    <button onClick={() => setPagination(p => ({...p, page: p.page - 1}))} disabled={pagination.page <= 1 || loading} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Previous</button>
                    <button onClick={() => setPagination(p => ({...p, page: p.page + 1}))} disabled={pagination.page >= pagination.totalPages || loading} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Next</button>
                </div>
            </div>
        </Card>
        {isAiQueryModalOpen && <AiQueryModal onClose={() => setIsAiQueryModalOpen(false)} onApplyFilters={handleApplyAiFilters} apiStatus={apiStatus}/>}
      </div>
    );
};

export default GlobalSearch;
