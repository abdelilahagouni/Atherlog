import * as React from 'react';
import { AiPlaybook, LogEntry } from '../types';
import { generateRemediationPlaybook } from '../services/geminiService';
import { saveInsight } from '../services/insightsService';
import { useToast } from '../hooks/useToast';
import { Icon } from './ui/Icon';

type AiProvider = 'gemini' | 'openai';

interface AiPlaybookModalProps {
  targetLog: LogEntry;
  provider: AiProvider;
  onClose: () => void;
}

const LoadingState: React.FC<{ provider: AiProvider }> = ({ provider }) => {
  const messages = [
    "Analyzing failure signature...",
    "Cross-referencing with known issues...",
    "Correlating with recent system events...",
    "Generating step-by-step remediation plan...",
  ];
  const [message, setMessage] = React.useState(messages[0]);

  React.useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setMessage(messages[index]);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
        <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" />
        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-200">
            Generating playbook with {provider}...
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 w-full transition-opacity duration-500">
            {message}
        </p>
    </div>
  );
};

const TriageStepView: React.FC<{ step: AiPlaybook['triageSteps'][0] }> = ({ step }) => {
    const { showToast } = useToast();
    const handleCopy = () => {
        if (step.command) {
            navigator.clipboard.writeText(step.command);
            showToast('Command copied to clipboard!', 'success');
        }
    };

    return (
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold">
                {step.step}
            </div>
            <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{step.action}</p>
                {step.command && (
                    <div className="mt-2 p-2 bg-gray-800 dark:bg-black/50 rounded-lg flex items-center gap-2 font-mono text-sm">
                        <span className="text-gray-400">$</span>
                        <code className="text-white flex-1 overflow-x-auto">{step.command}</code>
                        <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/20">
                            <Icon name="copy" className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

const AiPlaybookModal: React.FC<AiPlaybookModalProps> = ({ targetLog, provider, onClose }) => {
    const [playbook, setPlaybook] = React.useState<AiPlaybook | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const { showToast } = useToast();

    React.useEffect(() => {
        const getPlaybook = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await generateRemediationPlaybook(targetLog, provider);
                setPlaybook(result);
            } catch (err: any) {
                setError(err.message || 'Failed to generate playbook from AI.');
            } finally {
                setLoading(false);
            }
        };
        getPlaybook();
    }, [targetLog, provider]);

    const handleSaveInsight = async () => {
        if (!playbook) return;
        setIsSaving(true);
        try {
            await saveInsight({
                type: 'playbook',
                title: `Playbook: ${playbook.title}`,
                summary: playbook.summary,
                originalLog: targetLog,
                playbook: playbook,
            });
            showToast('Playbook saved to Learned Insights!', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const severityColors = [
        'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'
    ];
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="shield-check" className="w-6 h-6" />
                        AI Remediation Playbook
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {loading && <LoadingState provider={provider} />}
                    {error && <div className="text-center py-16 text-red-500">{error}</div>}
                    {!loading && playbook && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{playbook.title}</h3>
                                     <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Severity:</span>
                                        <div className="flex gap-1.5" title={`Severity ${playbook.severity} of 5`}>
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className={`w-5 h-2 rounded-full ${i < playbook.severity ? severityColors[i] : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-3 p-4 bg-blue-500/5 dark:bg-blue-500/10 border-l-4 border-blue-500 text-gray-700 dark:text-gray-200 rounded-r-lg">
                                    {playbook.summary}
                                </p>
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Triage Steps</h4>
                                <div className="space-y-4">
                                    {playbook.triageSteps.map(step => <TriageStepView key={step.step} step={step} />)}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Escalation Path</h4>
                                <div className="p-4 bg-yellow-100/50 dark:bg-yellow-500/10 border-l-4 border-yellow-500 rounded-r-lg">
                                    <p className="text-yellow-800 dark:text-yellow-200">{playbook.escalationPath}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                 <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-between items-center mt-auto flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">This playbook was generated by AI and may require human oversight.</p>
                    <div className="flex gap-4">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                            Close
                        </button>
                         <button 
                            type="button" 
                            onClick={handleSaveInsight} 
                            disabled={!playbook || isSaving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                             {isSaving && <Icon name="loader" className="w-5 h-5 animate-spin" />}
                            {isSaving ? 'Saving...' : 'Save to Insights'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiPlaybookModal;
