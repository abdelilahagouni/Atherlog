

import * as React from 'react';
import { getAlertHistory } from '../services/logService';
import { AlertHistoryEntry, LogLevel } from '../types';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import AlertDetailsModal from './AlertDetailsModal';

const LogLevelCell: React.FC<{ level: LogLevel }> = ({ level }) => {
    const levelColorMap: Record<LogLevel, string> = {
      [LogLevel.INFO]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
      [LogLevel.WARN]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
      [LogLevel.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
      [LogLevel.DEBUG]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      [LogLevel.FATAL]: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${levelColorMap[level]}`}>
        {level}
      </span>
    );
  };

const AlertHistory: React.FC = () => {
    const [history, setHistory] = React.useState<AlertHistoryEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedLevels, setSelectedLevels] = React.useState<Set<LogLevel>>(new Set());
    const [selectedAlert, setSelectedAlert] = React.useState<AlertHistoryEntry | null>(null);
    const { showToast } = useToast();


    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const historyData = await getAlertHistory();
                if (Array.isArray(historyData)) {
                    setHistory(historyData);
                } else {
                    console.error("Invalid history data received:", historyData);
                    setHistory([]);
                    setError("Received invalid data from server.");
                }
            } catch (err: any) {
                console.error("Failed to fetch alert history:", err);
                setError(err.message || "Failed to load alert history.");
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCopy = (e: React.MouseEvent, message: string) => {
        e.stopPropagation(); // Prevent row click from firing
        navigator.clipboard.writeText(message);
        showToast('Log message copied to clipboard!', 'success');
    };

    const toggleLevel = (level: LogLevel) => {
        setSelectedLevels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(level)) {
                newSet.delete(level);
            } else {
                newSet.add(level);
            }
            return newSet;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedLevels(new Set());
    };
    
    const filteredHistory = React.useMemo(() => {
        return history.filter(entry => {
            if (!entry || !entry.log) return false; // Safety check
            
            const message = entry.log.message || '';
            const source = entry.log.source || '';
            
            const searchTermMatch = searchTerm === '' || 
                message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                source.toLowerCase().includes(searchTerm.toLowerCase());
            
            const levelMatch = selectedLevels.size === 0 || (entry.log.level && selectedLevels.has(entry.log.level));

            return searchTermMatch && levelMatch;
        });
    }, [history, searchTerm, selectedLevels]);

    const levelColorMap: Record<LogLevel, { border: string; darkBorder: string; bg: string; text: string; darkText: string; hover: string; darkHover: string; selectedText: string; }> = {
        [LogLevel.INFO]: { border: 'border-blue-500', darkBorder: 'dark:border-blue-500', bg: 'bg-blue-500', text: 'text-blue-700', darkText: 'dark:text-blue-300', hover: 'hover:bg-blue-50', darkHover: 'dark:hover:bg-blue-500/20', selectedText: 'text-white' },
        [LogLevel.WARN]: { border: 'border-yellow-500', darkBorder: 'dark:border-yellow-500', bg: 'bg-yellow-500', text: 'text-yellow-700', darkText: 'dark:text-yellow-300', hover: 'hover:bg-yellow-50', darkHover: 'dark:hover:bg-yellow-500/20', selectedText: 'text-white' },
        [LogLevel.ERROR]: { border: 'border-red-500', darkBorder: 'dark:border-red-500', bg: 'bg-red-500', text: 'text-red-700', darkText: 'dark:text-red-300', hover: 'hover:bg-red-50', darkHover: 'dark:hover:bg-red-500/20', selectedText: 'text-white' },
        [LogLevel.DEBUG]: { border: 'border-gray-500', darkBorder: 'dark:border-gray-500', bg: 'bg-gray-500', text: 'text-gray-700', darkText: 'dark:text-gray-300', hover: 'hover:bg-gray-100', darkHover: 'dark:hover:bg-gray-500/20', selectedText: 'text-white' },
        [LogLevel.FATAL]: { border: 'border-purple-500', darkBorder: 'dark:border-purple-500', bg: 'bg-purple-500', text: 'text-purple-700', darkText: 'dark:text-purple-300', hover: 'hover:bg-purple-50', darkHover: 'dark:hover:bg-purple-500/20', selectedText: 'text-white' },
    };

    const hasActiveFilters = searchTerm !== '' || selectedLevels.size > 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Icon name="alert-triangle" className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Failed to Load History</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">{error}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Alert History</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">A log of all serious alerts that triggered a simulated SMS notification.</p>
            </div>

            <div className="p-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Search by message or source</label>
                        <div className="relative">
                            <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input 
                                type="text"
                                placeholder="e.g., 'meltdown' or 'api-gateway'..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Filter by Log Level</label>
                        <div className="flex flex-wrap gap-2">
                            {(Object.values(LogLevel) as LogLevel[]).map(level => {
                                const colors = levelColorMap[level as LogLevel];
                                const isSelected = selectedLevels.has(level);
                                return (
                                    <button 
                                        key={level} 
                                        onClick={() => toggleLevel(level)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-full border-2 transition-colors ${isSelected ? `${colors.bg} ${colors.selectedText} ${colors.border}` : `bg-transparent ${colors.border} ${colors.darkBorder} ${colors.text} ${colors.darkText} ${colors.hover} ${colors.darkHover}`}`}
                                    >
                                        {level}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {hasActiveFilters && (
                    <div className="flex justify-end">
                        <button onClick={clearFilters} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Clear Filters</button>
                    </div>
                )}
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Timestamp</th>
                                <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Level</th>
                                <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Source</th>
                                <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Message</th>
                                <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((entry) => {
                                if (!entry || !entry.log) return null;
                                return (
                                <tr 
                                    key={entry.id || Math.random()} 
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedAlert(entry)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {entry.log.level ? <LogLevelCell level={entry.log.level} /> : <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="px-6 py-4 font-mono">{entry.log.source || 'Unknown'}</td>
                                    <td className="px-6 py-4 max-w-md truncate" title={entry.log.message}>
                                        {entry.log.message || 'No message'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={(e) => handleCopy(e, entry.log.message || '')} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md" title="Copy message">
                                            <Icon name="copy" className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {filteredHistory.length === 0 && (
                        <div className="text-center py-12">
                            <Icon name="history" className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">No Alert History Found</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {hasActiveFilters ? 'No alerts match your current filters.' : 'No fatal errors have been logged yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </Card>

            {selectedAlert && (
                <AlertDetailsModal 
                    alert={selectedAlert} 
                    onClose={() => setSelectedAlert(null)} 
                />
            )}
        </div>
    );
};

export default AlertHistory;