import * as React from 'react';
import { Icon } from './ui/Icon';
import { getApiKeyStatus } from '../services/geminiService';
import { useToast } from '../hooks/useToast';

type ApiStatusValue = 'ok' | 'invalid_key' | 'not_configured' | 'checking' | 'quota_exceeded';

const StatusDisplay: React.FC<{
    status: ApiStatusValue;
    providerName: 'Gemini' | 'OpenAI';
}> = ({ status, providerName }) => {
    const { showToast } = useToast();

    const handleCopyCommand = () => {
        const command = providerName === 'Gemini'
            ? `API_KEY="YOUR_GEMINI_API_KEY_HERE"`
            : `OPENAI_API_KEY="YOUR_OPENAI_API_KEY_HERE"`;
        navigator.clipboard.writeText(command);
        showToast('Setup command copied to clipboard!', 'success');
    };

    if (status === 'checking') {
        return (
            <div className="bg-gray-100/50 dark:bg-gray-500/10 border border-gray-500/20 p-4 rounded-lg animate-pulse">
                <p className="text-sm text-gray-600 dark:text-gray-400">Verifying {providerName} configuration...</p>
            </div>
        );
    }

    const statusMap = {
        ok: {
            color: 'green',
            icon: 'check-circle',
            title: `${providerName} API Key is Configured & Valid`,
            message: `${providerName}'s AI features are enabled. The API key has been successfully validated with the API.`
        },
        invalid_key: {
            color: 'red',
            icon: 'exclamation-triangle',
            title: `${providerName} API Key is Invalid`,
            message: `The provided ${providerName} API key was rejected by the server. Please verify the key in your backend .env file is correct and has the necessary permissions, then restart the backend server.`
        },
        not_configured: {
            color: 'yellow',
            icon: 'exclamation-triangle',
            title: `${providerName} API Key Not Found`,
            message: `${providerName} features are currently disabled. Create a .env file in your backend directory and add your key. See README for instructions.`
        },
        quota_exceeded: {
            color: 'red',
            icon: 'exclamation-triangle',
            title: `${providerName} Quota Exceeded`,
            message: `Your ${providerName} account has run out of funds or has hit its spending limit. AI features using this provider are disabled.`
        }
    };

    const currentStatus = statusMap[status];

    return (
        <div className={`bg-${currentStatus.color}-100/50 dark:bg-${currentStatus.color}-500/10 border border-${currentStatus.color}-500/20 p-4 rounded-lg`}>
            <div className="flex items-start gap-4">
                <div className={`mt-1 text-${currentStatus.color}-600 dark:text-${currentStatus.color}-400`}>
                    <Icon name={currentStatus.icon} className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h4 className={`font-bold text-${currentStatus.color}-800 dark:text-${currentStatus.color}-300`}>
                        {currentStatus.title}
                    </h4>
                    <div>
                        <p className={`text-sm text-${currentStatus.color}-700 dark:text-${currentStatus.color}-300/80 mt-1`}>
                            {currentStatus.message}
                        </p>
                        {status === 'not_configured' && (
                            <button
                                onClick={handleCopyCommand}
                                className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white font-semibold transition-colors"
                            >
                                <Icon name="copy" className="w-4 h-4" />
                                Copy Setup Command
                            </button>
                        )}
                        {status === 'quota_exceeded' && providerName === 'OpenAI' && (
                            <a 
                                href="https://platform.openai.com/account/billing/overview" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="mt-3 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Go to OpenAI Billing &rarr;
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const ApiKeyStatus: React.FC = () => {
    const [geminiStatus, setGeminiStatus] = React.useState<ApiStatusValue>('checking');
    const [openaiStatus, setOpenaiStatus] = React.useState<ApiStatusValue>('checking');

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const status = await getApiKeyStatus();
                setGeminiStatus(status.geminiStatus as ApiStatusValue);
                setOpenaiStatus(status.openaiStatus as ApiStatusValue);
            } catch (error) {
                console.error("Could not verify API key status:", error);
                setGeminiStatus('not_configured');
                setOpenaiStatus('not_configured');
            }
        };
        checkStatus();
    }, []);

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-100/50 dark:bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-700 dark:text-blue-300/80">
                If both API keys are valid, **OpenAI (ChatGPT) will be prioritized** for most features. The Image Editor exclusively uses the Gemini API.
            </div>
            <StatusDisplay status={openaiStatus} providerName="OpenAI" />
            <StatusDisplay status={geminiStatus} providerName="Gemini" />
        </div>
    );
};

export default ApiKeyStatus;