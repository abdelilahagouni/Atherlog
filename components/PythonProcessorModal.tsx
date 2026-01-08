import * as React from 'react';
import { Icon } from './ui/Icon';
import { executePythonOnText } from '../services/geminiService';
import { useToast } from '../hooks/useToast';

type AiProvider = 'gemini' | 'openai';

interface PythonProcessorModalProps {
  logText: string;
  provider: AiProvider;
  onClose: () => void;
}

const initialScript = `# The extracted log text is available in the 'log_text' variable.
# Example: Count the number of lines containing the word "error".

error_count = 0
for line in log_text.split('\\n'):
    if "error" in line.lower():
        error_count += 1

print(f"Found 'error' in {error_count} lines.")
`;

const PythonProcessorModal: React.FC<PythonProcessorModalProps> = ({ logText, provider, onClose }) => {
    const [script, setScript] = React.useState(initialScript);
    const [output, setOutput] = React.useState<string>("// Output will appear here after running the script.");
    const [isLoading, setIsLoading] = React.useState(false);
    const { showToast } = useToast();

    const handleRunScript = async () => {
        setIsLoading(true);
        setOutput("Executing script...");
        try {
            const result = await executePythonOnText(logText, script, provider);
            setOutput(result);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to execute script.';
            setOutput(`ERROR: ${errorMessage}`);
            showToast(errorMessage, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="python" className="w-6 h-6" /> AI-Powered Python Processor
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
                    {/* Code Editor */}
                    <div className="flex flex-col h-full">
                        <label htmlFor="python-script" className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Python Script</label>
                        <textarea
                            id="python-script"
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            className="flex-1 w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 resize-none"
                            spellCheck="false"
                        />
                    </div>
                    {/* Output */}
                    <div className="flex flex-col h-full">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Output</label>
                        <div className="flex-1 w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 overflow-auto">
                            <pre className="whitespace-pre-wrap break-words">{output}</pre>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-between items-center mt-auto flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">The `log_text` variable is pre-defined with the extracted text.</p>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                            Close
                        </button>
                        <button
                            onClick={handleRunScript}
                            disabled={isLoading}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Icon name={isLoading ? "loader" : "play"} className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            {isLoading ? 'Running...' : 'Run Script'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PythonProcessorModal;
