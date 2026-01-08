import * as React from 'react';
import { LogEntry } from '../types';
import { explainLogEntry } from '../services/geminiService';
import { Icon } from './ui/Icon';

type AiProvider = 'gemini' | 'openai' | 'python';

interface ExplainAnomalyModalProps {
  logEntry: LogEntry;
  provider: AiProvider;
  onClose: () => void;
}

const ExplainAnomalyModal: React.FC<ExplainAnomalyModalProps> = ({ logEntry, provider, onClose }) => {
  const [explanation, setExplanation] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const getExplanation = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await explainLogEntry(logEntry, provider);
        setExplanation(result);
      } catch (err) {
        setError('Failed to get explanation from AI. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getExplanation();
  }, [logEntry, provider]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Log Analysis</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Original Log Entry</h3>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p><span className="font-bold text-blue-600 dark:text-blue-400">Timestamp:</span> {new Date(logEntry.timestamp).toISOString()}</p>
                <p><span className="font-bold text-blue-600 dark:text-blue-400">Level:</span> {logEntry.level}</p>
                <p><span className="font-bold text-blue-600 dark:text-blue-400">Source:</span> {logEntry.source}</p>
                {logEntry.anomalyScore !== undefined && (
                  <p><span className="font-bold text-red-600 dark:text-red-400">Anomaly Score:</span> {logEntry.anomalyScore.toFixed(3)}</p>
                )}
                <p><span className="font-bold text-blue-600 dark:text-blue-400">Message:</span> {logEntry.message}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">AI Explanation (via {provider})</h3>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg min-h-[200px] text-gray-800 dark:text-gray-200">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center">
                    <Icon name="loader" className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Analyzing log with {provider}...</p>
                  </div>
                </div>
              )}
              {error && <p className="text-red-500">{error}</p>}
              {!loading && !error && (
                 <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: explanation }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplainAnomalyModal;
