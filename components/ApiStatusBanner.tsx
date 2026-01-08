import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { getApiKeyStatus } from '../services/geminiService';

const ApiStatusBanner: React.FC = () => {
    const [isVisible, setIsVisible] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [errorType, setErrorType] = React.useState<'invalid_key' | 'quota_exceeded' | null>(null);

    React.useEffect(() => {
        const checkStatus = async () => {
            const dismissed = sessionStorage.getItem('apiStatusBannerDismissed');
            if (dismissed) {
                setIsVisible(false);
                return;
            }

            try {
                const status = await getApiKeyStatus();
                if (status.openaiStatus === 'quota_exceeded') {
                    setErrorMessage('Your OpenAI account has exceeded its current quota. Please check your billing details on the OpenAI platform.');
                    setErrorType('quota_exceeded');
                } else if (status.geminiStatus === 'invalid_key' && status.openaiStatus === 'invalid_key') {
                    setErrorMessage('Both configured Gemini and OpenAI API keys are invalid.');
                    setErrorType('invalid_key');
                } else if (status.geminiStatus === 'invalid_key') {
                    setErrorMessage('The configured Gemini API key is invalid.');
                    setErrorType('invalid_key');
                } else if (status.openaiStatus === 'invalid_key') {
                    setErrorMessage('The configured OpenAI API key is invalid.');
                    setErrorType('invalid_key');
                } else {
                    setIsVisible(false);
                }
            } catch (error) {
                console.error("Could not fetch API status for banner:", error);
            }
        };

        checkStatus();
    }, []);

    const handleDismiss = () => {
        sessionStorage.setItem('apiStatusBannerDismissed', 'true');
        setIsVisible(false);
    };

    if (!isVisible || !errorMessage) {
        return null;
    }

    return (
        <div className="mb-6 p-4 bg-yellow-100/50 dark:bg-yellow-500/10 border border-yellow-500/20 rounded-lg animate-fade-in">
            <div className="flex items-start gap-4">
                <div className="mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0">
                    <Icon name="exclamation-triangle" className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-yellow-800 dark:text-yellow-200">
                        {errorType === 'quota_exceeded' ? 'API Quota Exceeded' : 'API Key Error'}
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300/80 mt-1">
                        {errorMessage} Check your <code>.env</code> file in the <code>backend/</code> or root directory. AI features may be degraded.
                    </p>
                    <Link to="/settings" className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        Go to Settings for details &rarr;
                    </Link>
                </div>
                <button onClick={handleDismiss} className="p-1.5 text-yellow-700/70 dark:text-yellow-200/70 hover:text-yellow-800 dark:hover:text-yellow-100">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export default ApiStatusBanner;