import * as React from 'react';
import { AiDiscovery } from '../types';
import { discoverInsights, InsightsBasis } from '../services/geminiService';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import AiDiscoveryCard from './AiDiscoveryCard';
import { useToast } from '../hooks/useToast';

// Insights come ONLY from the internal BGL cascade's stored decisions (backend/insightsService.ts).
// No external AI provider is used, and the browser sends no log text.
const ProactiveInsights: React.FC = () => {
    const [discoveries, setDiscoveries] = React.useState<AiDiscovery[]>([]);
    const [basis, setBasis] = React.useState<InsightsBasis | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const { showToast } = useToast();

    const load = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await discoverInsights();
            setDiscoveries(result.insights);
            setBasis(result.basis);
        } catch (e: any) {
            console.error('Failed to compute insights:', e);
            setDiscoveries([]);
            setBasis(null);
            setError(e?.message || 'Failed to compute insights.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const handleDismissDiscovery = (id: string) => {
        setDiscoveries(current => current.filter(d => d.id !== id));
        showToast('Insight dismissed for this session.', 'success');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <Icon name="sparkles" className="w-8 h-8 text-[var(--accent-color-gold)]" />
                        Proactive AI Insights
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Patterns found in the decisions of your internal anomaly model (BGL cascade): anomaly spikes, new kinds
                        of anomalies, repeated patterns and rising anomaly rates. No external AI service is used.
                    </p>
                </div>
                <button onClick={load} disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-semibold flex items-center gap-2">
                    Refresh
                </button>
            </div>

            {isLoading && (
                <Card>
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-200">Analysing the anomaly model's decisions...</p>
                    </div>
                </Card>
            )}

            {!isLoading && error && (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                    <Icon name="exclamation-triangle" className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                        <p className="font-semibold">Insights could not be computed.</p>
                        <p className="mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {!isLoading && basis && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Based on {basis.scoredRecent.toLocaleString()} logs scored by {basis.model ?? 'the BGL cascade'} in the last {basis.windowHours} hours
                    ({basis.anomaliesRecent.toLocaleString()} flagged as anomalies), compared with the previous {basis.baselineDays} days
                    ({basis.scoredBaseline.toLocaleString()} scored).
                    {basis.notScoredRecent > 0 && ` ${basis.notScoredRecent.toLocaleString()} recent logs had no model decision and are not included.`}
                </p>
            )}

            {!isLoading && !error && discoveries.length > 0 && (
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

            {!isLoading && !error && discoveries.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    <Icon name="shield-check" className="w-16 h-16 mx-auto text-green-500" />
                    <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-gray-100">No New Insights Found</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
                        {basis && basis.scoredRecent === 0
                            ? 'No logs were scored by the anomaly model in the last 24 hours, so there is nothing to analyse yet.'
                            : 'The anomaly model found no spikes, new kinds of anomalies, repeated patterns or rising rates.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ProactiveInsights;
