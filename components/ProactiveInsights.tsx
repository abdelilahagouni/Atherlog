import * as React from 'react';
import { AiDiscovery } from '../types';
import { getHistoricalLogs } from '../services/logService';
import { discoverInsights, getApiKeyStatus } from '../services/geminiService';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import AiDiscoveryCard from './AiDiscoveryCard';
import { useToast } from '../hooks/useToast';

const ProactiveInsights: React.FC = () => {
    const [discoveries, setDiscoveries] = React.useState<AiDiscovery[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const { showToast } = useToast();

    React.useEffect(() => {
        const fetchAiInsights = async () => {
            setIsLoading(true);
            try {
                const status = await getApiKeyStatus();
                if (!status.geminiConfigured && !status.openaiConfigured) {
                    showToast('AI features are disabled. Please configure an API key in Org Settings.', 'info');
                    setDiscoveries([]);
                    return;
                }
                
                // Analyze a larger chunk of logs for a dedicated page
                const logs = await getHistoricalLogs(500); 
                if (logs.length > 50) {
                    const foundDiscoveries = await discoverInsights(logs);
                    setDiscoveries(foundDiscoveries);
                     if (foundDiscoveries.length === 0) {
                        showToast("Analysis complete. No new significant insights were found.", "info");
                    }
                } else {
                    showToast("Not enough log data to perform a proactive analysis.", "info");
                    setDiscoveries([]);
                }
            } catch (error: any) {
                console.error("Failed to fetch AI discoveries:", error);
                showToast(error.message || 'Failed to fetch AI discoveries.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        // Simulate a longer analysis time for the dedicated page
        setTimeout(fetchAiInsights, 1500);

    }, [showToast]);

    const handleDismissDiscovery = (id: string) => {
        setDiscoveries(current => current.filter(d => d.id !== id));
        showToast('Insight dismissed for this session.', 'success');
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                    <Icon name="sparkles" className="w-8 h-8 text-[var(--accent-color-gold)]" />
                    Proactive AI Insights
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    The AI periodically analyzes your recent log history to find emerging trends, new errors, and anomalous patterns that may require your attention.
                </p>
            </div>

            {isLoading && (
                <Card>
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-200">AI is analyzing recent logs for proactive insights...</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please wait a moment.</p>
                    </div>
                </Card>
            )}

            {!isLoading && discoveries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {discoveries.map((discovery, index) => (
                         <AiDiscoveryCard 
                            key={discovery.id}
                            discovery={discovery} 
                            onDismiss={() => handleDismissDiscovery(discovery.id)}
                            style={{ animationDelay: `${index * 100}ms`}}
                        />
                    ))}
                </div>
            )}
            
            {!isLoading && discoveries.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    <Icon name="shield-check" className="w-16 h-16 mx-auto text-green-500" />
                    <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-gray-100">No New Insights Found</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
                        The AI has analyzed your recent logs and found no new actionable insights at this time. This page will automatically update as new patterns are discovered.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ProactiveInsights;