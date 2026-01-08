import * as React from 'react';
import { getAuditLogs } from '../services/auditLogService';
import { AuditLogEntry } from '../types';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import AuditLogDetailsModal from './AuditLogDetailsModal';

const AuditLogs: React.FC = () => {
    const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedLog, setSelectedLog] = React.useState<AuditLogEntry | null>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const logData = await getAuditLogs();
            setLogs(logData);
            setLoading(false);
        };
        fetchData();
    }, []);

    const filteredLogs = React.useMemo(() => {
        return logs.filter(log =>
            log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [logs, searchTerm]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Audit Logs</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">A chronological record of all administrative actions taken within your organization.</p>
            </div>

            <Card>
                <div className="mb-4">
                    <label htmlFor="search-logs" className="sr-only">Search Logs</label>
                    <div className="relative">
                        <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            id="search-logs"
                            type="text"
                            placeholder="Search by user or action..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Timestamp</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Actor</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Action</th>
                                <th className="px-6 py-3 text-center border-b border-gray-200 dark:border-gray-700">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{log.username}</td>
                                    <td className="px-6 py-4">{log.action}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 rounded-full text-blue-700 dark:text-blue-300 font-semibold transition-colors"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.length === 0 && (
                    <div className="text-center py-12">
                        <Icon name="history" className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">No Audit Logs Found</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Administrative actions will be recorded here.
                        </p>
                    </div>
                )}
            </Card>

            {selectedLog && <AuditLogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};

export default AuditLogs;
