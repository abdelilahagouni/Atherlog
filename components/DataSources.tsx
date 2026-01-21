import * as React from 'react';
import { ApiKey } from '../types';
import { getApiKeys, createApiKey, deleteApiKey } from '../services/apiKeyService';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { API_BASE_URL } from '../utils/config';
import { useToast } from '../hooks/useToast';

const CodeSnippet: React.FC<{ apiKey: string }> = ({ apiKey }) => {
    const { showToast } = useToast();
    const [selected, setSelected] = React.useState<'cURL' | 'NodeJS'>('cURL');
    
    const snippets = {
        cURL: `curl -X POST ${API_BASE_URL}/api/ingest \\
-H "Content-Type: application/json" \\
-H "X-API-KEY: ${apiKey}" \\
-d '{
  "level": "INFO",
  "message": "Log from external application",
  "source": "my-custom-app"
}'`,
        NodeJS: `const https = require('http'); // or 'https' for production
const logData = JSON.stringify({
  level: 'INFO',
  message: 'Log from external application',
  source: 'my-custom-app'
});
const options = {
  hostname: 'localhost',
  port: 4000,
  path: '${API_BASE_URL}/api/ingest',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': '${apiKey}',
    'Content-Length': logData.length
  }
};
const req = https.request(options, res => console.log(\`statusCode: \${res.statusCode}\`));
req.on('error', error => console.error(error));
req.write(logData);
req.end();`
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(snippets[selected]);
        showToast('Code snippet copied!', 'success');
    };

    return (
        <div className="bg-gray-800 dark:bg-black/50 rounded-lg mt-4">
            <div className="flex border-b border-gray-700">
                {['cURL', 'NodeJS'].map(lang => (
                    <button key={lang} onClick={() => setSelected(lang as 'cURL' | 'NodeJS')} className={`px-4 py-2 text-sm font-medium ${selected === lang ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                        {lang}
                    </button>
                ))}
            </div>
            <div className="p-4 relative">
                 <button onClick={handleCopy} className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-gray-300 hover:text-white transition-colors" title="Copy code">
                    <Icon name="copy" className="w-4 h-4" />
                </button>
                <pre className="text-xs text-white overflow-x-auto"><code>{snippets[selected]}</code></pre>
            </div>
        </div>
    );
};


const DataSources: React.FC = () => {
    const [keys, setKeys] = React.useState<ApiKey[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [newKeyName, setNewKeyName] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [generatedKey, setGeneratedKey] = React.useState<{ name: string; rawKey: string } | null>(null);
    const { showToast } = useToast();

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

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;
        setIsCreating(true);
        try {
            const { rawKey } = await createApiKey(newKeyName);
            setGeneratedKey({ name: newKeyName, rawKey });
            setNewKeyName('');
            // Refetch keys to update the list
            const apiKeys = await getApiKeys();
            setKeys(apiKeys);
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteKey = async (keyId: string) => {
        if (!window.confirm('Are you sure you want to delete this API key? This action is irreversible.')) return;
        try {
            await deleteApiKey(keyId);
            setKeys(keys.filter(k => k.id !== keyId));
            showToast('API key deleted successfully.', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Icon name="loader" className="w-10 h-10 animate-spin" /></div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Data Sources</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage API keys to send log data from your applications to the AI Log Analyzer.</p>
            </div>

            {generatedKey && (
                <Card>
                    <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">API Key Generated!</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        Your new API key for "<span className="font-bold">{generatedKey.name}</span>" has been created. Please copy and store it securely. <strong className="text-yellow-600 dark:text-yellow-400">You will not be able to see it again.</strong>
                    </p>
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-4 font-mono text-sm">
                        <span className="text-gray-700 dark:text-gray-200 flex-1 truncate">{generatedKey.rawKey}</span>
                        <button onClick={() => { navigator.clipboard.writeText(generatedKey.rawKey); showToast('API Key copied!', 'success'); }} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md">
                            <Icon name="copy" className="w-5 h-5" />
                        </button>
                    </div>
                    <CodeSnippet apiKey={generatedKey.rawKey} />
                    <div className="text-right mt-4">
                        <button onClick={() => setGeneratedKey(null)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold">Done</button>
                    </div>
                </Card>
            )}

            <Card>
                <h3 className="text-xl font-semibold mb-4">Create New API Key</h3>
                <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., 'Production Web Server Key'"
                        className="flex-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                        disabled={isCreating}
                    />
                    <button type="submit" disabled={isCreating || !newKeyName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isCreating && <Icon name="loader" className="w-5 h-5 animate-spin" />}
                        {isCreating ? 'Generating...' : 'Generate Key'}
                    </button>
                </form>
            </Card>

            <Card>
                <h3 className="text-xl font-semibold mb-4">Existing API Keys</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Key Prefix</th>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3">Last Used</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {keys.map(key => (
                                <tr key={key.id} className="border-t border-gray-200 dark:border-gray-700">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{key.name}</td>
                                    <td className="px-4 py-3 font-mono">{key.keyPrefix}...</td>
                                    <td className="px-4 py-3">{new Date(key.createdAt).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">{key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleDeleteKey(key.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md" title="Delete key">
                                            <Icon name="trash" className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {keys.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No API keys have been created yet.</p>}
                </div>
            </Card>
        </div>
    );
};

export default DataSources;