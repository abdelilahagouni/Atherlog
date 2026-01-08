import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { getIncidents } from '../services/incidentService';
import { Incident, IncidentStatus } from '../types';

const StatusBadge: React.FC<{ status: IncidentStatus }> = ({ status }) => {
  const statusMap: Record<IncidentStatus, string> = {
    [IncidentStatus.INVESTIGATING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    [IncidentStatus.ACKNOWLEDGED]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    [IncidentStatus.RESOLVED]: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
  };
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusMap[status]}`}>
      {status}
    </span>
  );
};

const SeverityIndicator: React.FC<{ severity: number }> = ({ severity }) => {
    const severityColors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
    return (
        <div className="flex items-center gap-1" title={`Severity ${severity} of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < severity ? severityColors[i] : 'bg-gray-200 dark:bg-gray-700'}`}></div>
            ))}
        </div>
    );
};

const IncidentCenter: React.FC = () => {
    const [incidents, setIncidents] = React.useState<Incident[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { showToast } = useToast();
    const navigate = useNavigate();

    React.useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const data = await getIncidents();
                setIncidents(data);
            } catch (error: any) {
                showToast(error.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchIncidents();
    }, [showToast]);

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
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Incident Command Center</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    A real-time overview of all automatically-detected critical incidents.
                </p>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Date</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Incident Title</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Status</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Severity</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Trigger Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidents.map((incident) => (
                                <tr 
                                    key={incident.id} 
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/incidents/${incident.id}`)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(incident.createdAt).toLocaleString()}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{incident.title}</td>
                                    <td className="px-6 py-4"><StatusBadge status={incident.status} /></td>
                                    <td className="px-6 py-4"><SeverityIndicator severity={incident.severity} /></td>
                                    <td className="px-6 py-4 font-mono">{incident.triggeringLog.source}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {incidents.length === 0 && (
                        <div className="text-center py-12">
                            <Icon name="shield-check" className="w-16 h-16 mx-auto text-green-500" />
                            <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-gray-100">All Systems Operational</h3>
                            <p className="mt-2 text-gray-500 dark:text-gray-400">
                                No critical incidents have been detected. The system is actively monitoring for issues.
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default IncidentCenter;