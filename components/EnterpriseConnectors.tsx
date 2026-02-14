import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { API_BASE_URL } from '../utils/config';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';

interface Connector {
    id: string;
    name: string;
    icon: string;
    description: string;
    status: 'active' | 'inactive' | 'error';
    lastSync: string | null;
    lastError?: string | null;
}

const EnterpriseConnectors: React.FC = () => {
    const [connectors, setConnectors] = React.useState<Connector[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedConnector, setSelectedConnector] = React.useState<Connector | null>(null);
    const [config, setConfig] = React.useState<any>({});
    const [loadingConfig, setLoadingConfig] = React.useState(false);
    const [testingConnection, setTestingConnection] = React.useState(false);
    const { showToast } = useToast();
    // const { token } = useAuth(); // Token is not exposed in context
    const token = localStorage.getItem('jwt_token');

    const fetchConnectors = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/connectors`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch connectors');
            const data = await res.json();
            setConnectors(data);
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [token, showToast]);

    React.useEffect(() => {
        fetchConnectors();
    }, [fetchConnectors]);

    React.useEffect(() => {
        const loadConfig = async () => {
            if (!selectedConnector) return;
            setLoadingConfig(true);
            try {
                const res = await fetch(`${API_BASE_URL}/connectors/${selectedConnector.id}/config`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load configuration');
                const data = await res.json();
                setConfig(data?.config || {});
            } catch (error: any) {
                showToast(error.message, 'error');
                setConfig({});
            } finally {
                setLoadingConfig(false);
            }
        };

        loadConfig();
    }, [selectedConnector, token, showToast]);

    const handleSaveConfig = async () => {
        if (!selectedConnector) return;
        try {
            const res = await fetch(`${API_BASE_URL}/connectors/${selectedConnector.id}/config`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save configuration');
            
            showToast('Configuration saved successfully!', 'success');
            fetchConnectors(); // Refresh status
            setSelectedConnector(null);
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const handleTestConnection = async () => {
        if (!selectedConnector) return;
        setTestingConnection(true);
        try {
            const res = await fetch(`${API_BASE_URL}/connectors/${selectedConnector.id}/test`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message || 'Connection failed');
            
            showToast(data.message, 'success');
            fetchConnectors();
        } catch (error: any) {
            showToast(error.message, 'error');
            fetchConnectors();
        } finally {
            setTestingConnection(false);
        }
    };

    const handleToggle = async (connector: Connector) => {
        try {
            const newStatus = connector.status === 'active' ? false : true;
            const res = await fetch(`${API_BASE_URL}/connectors/${connector.id}/toggle`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: newStatus })
            });
            if (!res.ok) throw new Error('Failed to toggle connector');
            
            fetchConnectors();
            showToast(`Connector ${newStatus ? 'enabled' : 'disabled'}.`, 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Integration Marketplace</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Connect your stack for seamless log ingestion and alerting.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchConnectors} className="p-2 text-gray-500 hover:text-blue-500 transition-colors" title="Refresh">
                        <Icon name="refresh" className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connectors.map(connector => (
                    <Card 
                        key={connector.id} 
                        className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl border-2 ${connector.status === 'active' ? 'border-green-500/20' : 'border-transparent'}`}
                    >
                        <div className="absolute top-4 right-4">
                            <div className={`w-3 h-3 rounded-full ${connector.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} title={connector.status === 'active' ? 'Online' : 'Offline'} />
                        </div>

                        <div className="flex items-start space-x-4 mb-4">
                            <div className={`p-3 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:scale-110 transition-transform duration-300`}>
                                <Icon name={connector.icon as any} className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{connector.name}</h3>
                                <p className="text-xs text-gray-500">{connector.status === 'active' ? 'Connected' : 'Not Connected'}</p>
                            </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 h-10 line-clamp-2">{connector.description}</p>

                        {connector.status === 'error' && connector.lastError && (
                            <p className="text-xs text-red-600 dark:text-red-400 mb-4 line-clamp-2">{connector.lastError}</p>
                        )}

                        <div className="flex gap-3 mt-auto">
                            <button 
                                onClick={() => { setSelectedConnector(connector); }}
                                className="flex-1 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                            >
                                Configure
                            </button>
                            <button 
                                onClick={() => handleToggle(connector)}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                    connector.status === 'active' 
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 hover:bg-red-100' 
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                {connector.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Configuration Modal */}
            {selectedConnector && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <Card className="w-full max-w-2xl shadow-2xl border-t-4 border-blue-500">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <Icon name={selectedConnector.icon as any} className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Configure {selectedConnector.name}</h3>
                            </div>
                            <button onClick={() => setSelectedConnector(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <Icon name="x" className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {loadingConfig && (
                                <div className="flex justify-center items-center py-10">
                                    <Icon name="loader" className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            )}

                            {!loadingConfig && selectedConnector.status === 'error' && selectedConnector.lastError && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                                    {selectedConnector.lastError}
                                </div>
                            )}

                            {!loadingConfig && (
                                <>
                                    {/* Dynamic form fields based on connector type */}
                                    {selectedConnector.id === 'aws' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Key ID</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                    placeholder="AKIA..."
                                                    value={config.accessKeyId || ''}
                                                    onChange={e => setConfig({...config, accessKeyId: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secret Access Key</label>
                                                <input 
                                                    type="password" 
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                    placeholder="Secret key..."
                                                    value={config.secretAccessKey || ''}
                                                    onChange={e => setConfig({...config, secretAccessKey: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                    placeholder="us-east-1"
                                                    value={config.region || 'us-east-1'}
                                                    onChange={e => setConfig({...config, region: e.target.value})}
                                                />
                                            </div>
                                        </>
                                    )}                                    {selectedConnector.id === 'slack' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                placeholder="https://hooks.slack.com/services/..."
                                                value={config.webhookUrl || ''}
                                                onChange={e => setConfig({...config, webhookUrl: e.target.value})}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Create an Incoming Webhook in your Slack app settings.</p>
                                        </div>
                                    )}

                                    {selectedConnector.id === 'pagerduty' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Integration / Routing Key</label>
                                            <input 
                                                type="password" 
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                placeholder="32-character integration key..."
                                                value={config.routingKey || ''}
                                                onChange={e => setConfig({...config, routingKey: e.target.value})}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Find this in PagerDuty → Service → Integrations → Events API v2.</p>
                                        </div>
                                    )}

                                    {selectedConnector.id === 'datadog' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                                                <input 
                                                    type="password" 
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                    placeholder="Datadog API key..."
                                                    value={config.apiKey || ''}
                                                    onChange={e => setConfig({...config, apiKey: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site (optional)</label>
                                                <select 
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                    value={config.site || 'datadoghq.com'}
                                                    onChange={e => setConfig({...config, site: e.target.value})}
                                                >
                                                    <option value="datadoghq.com">US (datadoghq.com)</option>
                                                    <option value="datadoghq.eu">EU (datadoghq.eu)</option>
                                                    <option value="us3.datadoghq.com">US3 (us3.datadoghq.com)</option>
                                                    <option value="us5.datadoghq.com">US5 (us5.datadoghq.com)</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Generic fallback for Azure/GCP */}
                                    {!['aws', 'slack', 'pagerduty', 'datadog'].includes(selectedConnector.id) && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key / Connection String</label>
                                            <input 
                                                type="password" 
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"
                                                placeholder="Enter credentials..."
                                                value={config.apiKey || ''}
                                                onChange={e => setConfig({...config, apiKey: e.target.value})}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <button 
                                    onClick={handleTestConnection}
                                    disabled={testingConnection}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                    {testingConnection ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="activity" className="w-4 h-4" />}
                                    Test Connection
                                </button>
                                <div className="flex-1"></div>
                                <button 
                                    onClick={() => setSelectedConnector(null)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSaveConfig}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 transition-all"
                                >
                                    Save & Enable
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default EnterpriseConnectors;
