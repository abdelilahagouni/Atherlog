import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

const Collaboration: React.FC = () => {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [slackWebhook, setSlackWebhook] = React.useState('');
    const [teamsWebhook, setTeamsWebhook] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        // Fetch current webhooks from backend
        const fetchWebhooks = async () => {
            try {
                const response = await fetch('/api/organization/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSlackWebhook(data.slackWebhookUrl || '');
                    setTeamsWebhook(data.teamsWebhookUrl || '');
                }
            } catch (err) {
                console.error('Failed to load webhooks', err);
            }
        };
        if (token) fetchWebhooks();
    }, [token]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/organization/settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ slackWebhookUrl: slackWebhook, teamsWebhookUrl: teamsWebhook })
            });
            if (!res.ok) throw new Error('Failed to update webhooks');
            showToast('Collaboration settings saved successfully', 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTest = async (type: 'slack' | 'teams') => {
        const url = type === 'slack' ? slackWebhook : teamsWebhook;
        if (!url) {
            showToast(`Please enter a ${type} webhook URL first`, 'error');
            return;
        }
        try {
            const res = await fetch('/api/organization/webhooks/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type, url })
            });
            if (!res.ok) throw new Error(`Failed to send test message to ${type}`);
            showToast(`Test message sent to ${type}!`, 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Icon name="message-square" className="w-8 h-8 text-indigo-500" />
                    ChatOps & Collaboration
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Connect AetherLog to your team's chat tools to receive rich anomaly and incident alerts.
                </p>
            </div>

            <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#4A154B] rounded flex items-center justify-center">
                        <Icon name="slack" className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Slack Integration</h2>
                        <p className="text-sm text-gray-500">Receive interactive blocked messages for critical alerts.</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Slack Incoming Webhook URL
                        </label>
                        <input
                            type="password"
                            placeholder="https://hooks.slack.com/services/..."
                            value={slackWebhook}
                            onChange={(e) => setSlackWebhook(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTest('slack')}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm"
                        >
                            Test Connection
                        </button>
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#6264A7] rounded flex items-center justify-center">
                        <Icon name="users" className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Microsoft Teams Integration</h2>
                        <p className="text-sm text-gray-500">Receive adaptive cards for critical alerts in Teams channels.</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Teams Webhook URL
                        </label>
                        <input
                            type="password"
                            placeholder="https://your-domain.webhook.office.com/webhookb2/..."
                            value={teamsWebhook}
                            onChange={(e) => setTeamsWebhook(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTest('teams')}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm"
                        >
                            Test Connection
                        </button>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    {isLoading ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default Collaboration;
