import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

interface Runbook {
    id: string;
    name: string;
    description: string;
    triggerType: 'webhook' | 'script' | 'aws_lambda';
    config: any;
    enabled: boolean;
    createdAt: string;
}

const Runbooks: React.FC = () => {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [runbooks, setRunbooks] = React.useState<Runbook[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const [isCreating, setIsCreating] = React.useState(false);
    const [newName, setNewName] = React.useState('');
    const [newDesc, setNewDesc] = React.useState('');
    const [newWebhookUrl, setNewWebhookUrl] = React.useState('');

    const fetchRunbooks = async () => {
        try {
            const res = await fetch('/api/runbooks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRunbooks(data);
            }
        } catch (err) {
            console.error('Failed to load runbooks', err);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        if (token) fetchRunbooks();
    }, [token]);

    const handleCreate = async () => {
        if (!newName || !newWebhookUrl) {
            showToast('Name and Webhook URL are required', 'error');
            return;
        }
        try {
            const res = await fetch('/api/runbooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newName,
                    description: newDesc,
                    triggerType: 'webhook',
                    enabled: true,
                    config: {
                        url: newWebhookUrl,
                        method: 'POST'
                    }
                })
            });
            if (!res.ok) throw new Error('Failed to create runbook');
            showToast('Runbook created successfully', 'success');
            setIsCreating(false);
            setNewName('');
            setNewDesc('');
            setNewWebhookUrl('');
            fetchRunbooks();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this runbook?')) return;
        try {
            const res = await fetch(`/api/runbooks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete runbook');
            showToast('Runbook deleted', 'success');
            setRunbooks(runbooks.filter(r => r.id !== id));
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleTrigger = async (id: string) => {
        try {
            const res = await fetch(`/api/runbooks/${id}/trigger`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to trigger runbook');
            showToast('Runbook triggered manually', 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="zap" className="w-8 h-8 text-yellow-500" />
                        Automated Remediations (Runbooks)
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Define automated workflows that trigger instantly when an anomaly occurs.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <Icon name="plus" className="w-4 h-4" />
                    New Runbook
                </button>
            </div>

            {isCreating && (
                <Card className="p-6 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4">Create Webhook Runbook</h3>
                    <div className="space-y-4 max-w-xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. Restart Payment Service"
                                className="w-full bg-white dark:bg-gray-900 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <input
                                type="text"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                placeholder="Triggers a webhook to restart the prod pod."
                                className="w-full bg-white dark:bg-gray-900 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Webhook URL</label>
                            <input
                                type="text"
                                value={newWebhookUrl}
                                onChange={e => setNewWebhookUrl(e.target.value)}
                                placeholder="https://api.github.com/repos/.../dispatches"
                                className="w-full bg-white dark:bg-gray-900 rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleCreate} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                                Save Runbook
                            </button>
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium">
                                Cancel
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid gap-4">
                {isLoading ? (
                    <div className="text-gray-500">Loading runbooks...</div>
                ) : runbooks.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-gray-800">
                        <Icon name="book" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No runbooks defined</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">Create a runbook to automate incident remediation steps.</p>
                    </div>
                ) : (
                    runbooks.map((runbook) => (
                        <Card key={runbook.id} className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${runbook.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                    <Icon name={runbook.triggerType === 'webhook' ? 'globe' : 'terminal'} className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        {runbook.name}
                                        {!runbook.enabled && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Disabled</span>}
                                    </h3>
                                    <p className="text-sm text-gray-500">{runbook.description}</p>
                                    <div className="mt-2 text-xs font-mono text-gray-400">
                                        {runbook.triggerType.toUpperCase()} &rarr; {runbook.config?.url}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                                <button
                                    onClick={() => handleTrigger(runbook.id)}
                                    className="flex-1 md:flex-none px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded flex justify-center items-center gap-1 transition-colors"
                                >
                                    <Icon name="play" className="w-4 h-4" /> Trigger
                                </button>
                                <button
                                    onClick={() => handleDelete(runbook.id)}
                                    className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded flex justify-center items-center gap-1 transition-colors"
                                >
                                    <Icon name="trash" className="w-4 h-4" />
                                </button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default Runbooks;
