import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { getHistoricalLogs } from '../services/logService';
import { findLogPatterns as findAiLogPatterns, getApiKeyStatus } from '../services/geminiService';
import { LogPattern } from '../types';
import { saveInsight } from '../services/insightsService';
import { findLocalPatterns } from '../services/localPatternService';
import { AiChoiceDropdown } from './ui/AiChoiceDropdown';

type AiProvider = 'gemini' | 'openai';

const PatternCard: React.FC<{ pattern: LogPattern, onSave: () => void }> = ({ pattern, onSave }) => {
    const typeColors = {
        Temporal: 'border-blue-500 bg-blue-500/10 text-blue-300',
        Causal: 'border-purple-500 bg-purple-500/10 text-purple-300',
        Behavioral: 'border-green-500 bg-green-500/10 text-green-300',
        Unknown: 'border-gray-500 bg-gray-500/10 text-gray-300',
    };

    return (
        <Card className={`border-l-4 ${typeColors[pattern.type]}`}>
            <div className="flex justify-between items-start">
                <div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeColors[pattern.type]}`}>{pattern.type} Pattern</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2">{pattern.title}</h3>
                </div>
                 <button 
                    onClick={onSave}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white font-semibold transition-colors"
                    title="Save to Learned Insights"
                >
                    <Icon name="brain" className="w-4 h-4" />
                    Save
                </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-2">{pattern.description}</p>
        </Card>
    );
};

const PatternRecognition: React.FC = () => {
    const [patterns, setPatterns] = React.useState<LogPattern[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingLocal, setIsLoadingLocal] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; }>({ geminiConfigured: false, openaiConfigured: false });
    const { showToast } = useToast();

     React.useEffect(() => {
        getApiKeyStatus().then(setApiStatus).catch(() => {
            showToast('Could not verify API key status.', 'error');
        });
    }, [showToast]);

    const isAiAvailable = apiStatus.geminiConfigured || apiStatus.openaiConfigured;

    const handleAiAnalyze = async (provider: AiProvider) => {
        setIsLoading(true);
        setError(null);
        setPatterns([]);
        try {
            const historicalLogs = await getHistoricalLogs();
            if (historicalLogs.length === 0) {
                showToast("No historical logs found to analyze.", "info");
                return;
            }
            const foundPatterns = await findAiLogPatterns(historicalLogs, provider);
            setPatterns(foundPatterns);
            if (foundPatterns.length === 0) {
                showToast("AI analysis complete. No significant new patterns were found in the log history.", "info");
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            showToast(err.message || 'Failed to analyze patterns.', 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLocalAnalyze = async () => {
        setIsLoadingLocal(true);
        setError(null);
        setPatterns([]);
        try {
            // Simulate a short delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            const historicalLogs = await getHistoricalLogs();
            if (historicalLogs.length === 0) {
                showToast("No historical logs found to analyze.", "info");
                return;
            }
            const foundPatterns = findLocalPatterns(historicalLogs);
            setPatterns(foundPatterns);
            if (foundPatterns.length === 0) {
                showToast("Basic scan complete. No obvious patterns found based on predefined rules.", "info");
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during local scan.');
            showToast(err.message || 'Failed to analyze patterns locally.', 'error');
        } finally {
            setIsLoadingLocal(false);
        }
    };
    
    const handleSavePattern = async (pattern: LogPattern) => {
        try {
            await saveInsight({
                type: 'pattern',
                title: `Pattern: ${pattern.title}`,
                summary: pattern.description,
                pattern: pattern,
            });
            showToast(`Pattern '${pattern.title}' saved to Learned Insights.`, 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const isAnyLoading = isLoading || isLoadingLocal;

    const aiChoices = [
        { label: 'Analyze with OpenAI', provider: 'openai' as AiProvider, action: handleAiAnalyze, disabled: !apiStatus.openaiConfigured, icon: 'sparkles' },
        { label: 'Analyze with Gemini', provider: 'gemini' as AiProvider, action: handleAiAnalyze, disabled: !apiStatus.geminiConfigured, icon: 'logo' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">AI Pattern Recognition</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Perform data mining on historical logs to uncover recurring patterns and correlations.</p>
            </div>

            <Card>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analyze Log History</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                            Run a basic scan for common patterns, or use AI for a deep analysis of recent log entries to find temporal, causal, and behavioral patterns.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleLocalAnalyze}
                            disabled={isAnyLoading}
                            className="w-full sm:w-auto flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Icon name={isLoadingLocal ? "loader" : "search"} className={`w-5 h-5 ${isLoadingLocal ? 'animate-spin' : ''}`} />
                            {isLoadingLocal ? 'Scanning...' : 'Run Basic Scan'}
                        </button>
                        <AiChoiceDropdown choices={aiChoices} isLoading={isLoading} onAction={handleAiAnalyze}>
                            Analyze with AI
                        </AiChoiceDropdown>
                    </div>
                </div>
            </Card>
            
            {isAnyLoading && (
                <div className="text-center py-8">
                    <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="mt-4 text-gray-600 dark:text-gray-300">{isLoading ? 'AI is mining your log data for patterns...' : 'Running basic scan...'}</p>
                </div>
            )}

            {error && !isAnyLoading && (
                <div className="text-center py-8 bg-red-500/10 p-4 rounded-lg">
                    <p className="text-red-700 dark:text-red-300 font-semibold">An error occurred:</p>
                    <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
                </div>
            )}
            
            {!isAnyLoading && patterns.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Discovered Patterns</h3>
                    {patterns.map(p => <PatternCard key={p.id} pattern={p} onSave={() => handleSavePattern(p)} />)}
                </div>
            )}
            
             {!isAnyLoading && !error && patterns.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    <Icon name="search-check" className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-gray-100">Ready for Analysis</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                        Click one of the analysis buttons to begin data mining.
                    </p>
                </div>
            )}

        </div>
    );
};

export default PatternRecognition;