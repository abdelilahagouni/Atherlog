import * as React from 'react';
import { LogEntry, RootCauseAnalysisResponse } from '../types';
import { performRootCauseAnalysis } from '../services/geminiService';
import { Icon } from './ui/Icon';

type AiProvider = 'gemini' | 'openai';

interface RootCauseAnalysisModalProps {
  targetLog: LogEntry;
  logHistory: LogEntry[];
  provider: AiProvider;
  onClose: () => void;
}

const LogLine: React.FC<{ log: LogEntry, isTarget?: boolean }> = ({ log, isTarget = false }) => (
    <div className={`p-2 rounded-md font-mono text-xs ${isTarget ? 'bg-red-500/10 border border-red-500/20' : 'bg-black/5 dark:bg-white/5'}`}>
        <span className="text-gray-500 dark:text-gray-400 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
        <span className="font-bold mr-2 text-sky-600 dark:text-sky-400">{log.source}</span>
        <span>{log.message}</span>
    </div>
);


const RootCauseAnalysisModal: React.FC<RootCauseAnalysisModalProps> = ({ targetLog, logHistory, provider, onClose }) => {
    const [analysis, setAnalysis] = React.useState<RootCauseAnalysisResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const getAnalysis = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await performRootCauseAnalysis(targetLog, logHistory, provider);
                setAnalysis(result);
            } catch (err: any) {
                setError(err.message || 'Failed to get root cause analysis from AI.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        getAnalysis();
    }, [targetLog, logHistory, provider]);
    
    const keyEventLogs = React.useMemo(() => {
        if (!analysis) return [];
        const keyEventIds = new Set(analysis.keyEvents);
        return logHistory.filter(log => keyEventIds.has(log.id));
    }, [analysis, logHistory]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="sitemap" className="w-6 h-6" />
                        AI Root Cause Analysis
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                            <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" />
                            <p className="mt-4 text-gray-600 dark:text-gray-300">Analyzing event timeline with {provider}...</p>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This may take a moment for complex histories.</p>
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-16">
                            <p className="text-red-500">{error}</p>
                        </div>
                    )}
                    
                    {!loading && analysis && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">AI Summary</h3>
                                <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 border-l-4 border-blue-500 text-gray-700 dark:text-gray-200 rounded-r-lg">
                                    <p>{analysis.summary}</p>
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Key Event Timeline</h3>
                                <div className="space-y-2">
                                    {keyEventLogs.map(log => <LogLine key={log.id} log={log} />)}
                                    <LogLine log={targetLog} isTarget={true} />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Suggested Next Steps</h3>
                                <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200">
                                    {analysis.nextSteps.map((step, index) => <li key={index}>{step}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-end gap-4 mt-auto">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RootCauseAnalysisModal;