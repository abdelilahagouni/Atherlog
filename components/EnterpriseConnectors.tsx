import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { API_BASE_URL } from '../utils/config';
import { useToast } from '../hooks/useToast';
import { getApiKeys, createApiKey } from '../services/apiKeyService';
import { ApiKey } from '../types';

const EnterpriseConnectors: React.FC = () => {
    const [keys, setKeys] = React.useState<ApiKey[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { showToast } = useToast();
    const [selectedPlatform, setSelectedPlatform] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchKeys = async () => {
            try {
                const apiKeys = await getApiKeys();
                setKeys(apiKeys);
            } catch (error: any) {
                showToast(error.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchKeys();
    }, [showToast]);

    const platforms = [
        { id: 'aws', name: 'AWS CloudWatch', icon: 'cloud', color: 'text-orange-500', description: 'Stream logs from AWS Lambda, EC2, and RDS.' },
        { id: 'azure', name: 'Azure Monitor', icon: 'cloud', color: 'text-blue-500', description: 'Connect Azure App Services and Functions.' },
        { id: 'gcp', name: 'Google Cloud Logging', icon: 'cloud', color: 'text-red-500', description: 'Ingest logs from GKE and Cloud Functions.' },
        { id: 'kubernetes', name: 'Kubernetes', icon: 'container', color: 'text-blue-600', description: 'Deploy our sidecar to monitor your pods.' },
        { id: 'custom', name: 'Custom App (API)', icon: 'code', color: 'text-green-500', description: 'Send logs from any Node, Python, or Go app.' }
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Enterprise Connectors</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Connect your external platforms to AetherLog for real-time AI monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platforms.map(platform => (
                    <Card 
                        key={platform.id} 
                        className={`cursor-pointer transition-all transform hover:scale-[1.02] hover:shadow-xl border-2 ${selectedPlatform === platform.id ? 'border-blue-500 bg-blue-500/5' : 'border-transparent'}`}
                        onClick={() => setSelectedPlatform(platform.id)}
                    >
                        <div className="flex items-start space-x-4">
                            <div className={`p-3 rounded-xl bg-gray-100 dark:bg-gray-800 ${platform.color}`}>
                                <Icon name={platform.icon as any} className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-gray-100">{platform.name}</h3>
                                <p className="text-xs text-gray-500 mt-1">{platform.description}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {selectedPlatform && (
                <Card className="animate-slide-up-fade-in bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Icon name="settings" className="w-6 h-6 text-blue-500" />
                            Setup Guide: {platforms.find(p => p.id === selectedPlatform)?.name}
                        </h3>
                        <button onClick={() => setSelectedPlatform(null)} className="text-gray-400 hover:text-gray-200">
                            <Icon name="x" className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shrink-0">1</div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-gray-100">Select or Create an API Key</p>
                                <select className="mt-2 w-full max-w-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm">
                                    <option value="">-- Select an existing key --</option>
                                    {keys.map(key => (
                                        <option key={key.id} value={key.id}>{key.name} ({key.keyPrefix}...)</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shrink-0">2</div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-gray-100">Configure your Platform</p>
                                <div className="mt-4 p-4 bg-black/50 rounded-xl font-mono text-xs text-blue-400 space-y-2">
                                    <p># Example configuration for {selectedPlatform}</p>
                                    <p>INGEST_URL: "{API_BASE_URL}/api/ingest"</p>
                                    <p>API_KEY: "YOUR_SELECTED_KEY_HERE"</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shrink-0">3</div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-gray-100">Verify Connection</p>
                                <button className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
                                    Test Connection
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default EnterpriseConnectors;
