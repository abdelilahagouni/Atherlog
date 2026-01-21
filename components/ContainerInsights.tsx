import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Pod, ContainerStatus, PodStatus } from '../types';
import { getContainers, getPods } from '../services/mockInfraService';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';

const StatusBadge: React.FC<{ status: ContainerStatus | PodStatus }> = ({ status }) => {
  const statusMap: Record<ContainerStatus | PodStatus, { color: string, icon: React.ReactNode }> = {
    [ContainerStatus.Running]: { color: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300', icon: <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> },
    [ContainerStatus.Stopped]: { color: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300', icon: <div className="w-2 h-2 rounded-full bg-red-500"></div> },
    [ContainerStatus.Restarting]: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300', icon: <div className="w-2 h-2 rounded-full bg-yellow-500 animate-ping"></div> },
    // FIX: Removed duplicate key for 'Running' status. PodStatus.Running has the same string value as ContainerStatus.Running.
    [PodStatus.Pending]: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300', icon: <div className="w-2 h-2 rounded-full bg-yellow-500"></div> },
    [PodStatus.Failed]: { color: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300', icon: <div className="w-2 h-2 rounded-full bg-red-500"></div> },
    [PodStatus.Succeeded]: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300', icon: <div className="w-2 h-2 rounded-full bg-blue-500"></div> },
  };

  return (
    <span className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded-full ${statusMap[status].color}`}>
      {statusMap[status].icon}
      {status}
    </span>
  );
};


const ContainerInsights: React.FC = () => {
    const [containers, setContainers] = React.useState<Container[]>([]);
    const [pods, setPods] = React.useState<Pod[]>([]);
    const [loading, setLoading] = React.useState(true);
    const navigate = useNavigate();

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [containersData, podsData] = await Promise.all([getContainers(), getPods()]);
                setContainers(containersData);
                setPods(podsData);
            } catch (error) {
                console.error("Failed to fetch initial infra data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        const interval = setInterval(fetchData, 3000); // Refresh every 3 seconds

        return () => clearInterval(interval);
    }, []);

    const handleContainerAction = (containerName: string, action: 'Stop' | 'Restart' | 'Logs') => {
        if (action === 'Logs') {
            navigate(`/log-explorer?sources=${containerName}`);
        } else {
            console.log(`${action} action triggered for container: ${containerName}`);
            // In a real app, you would call your backend API here.
        }
    };
    
    const handlePodAction = (podName: string, action: 'Describe' | 'Delete' | 'Logs') => {
        if (action === 'Logs') {
            // Pod names are often long, we can try to find a source that matches. A real system would use labels.
             const source = pods.find(p => p.name === podName)?.name.split('-deployment-')[0];
             if(source) {
                navigate(`/log-explorer?sources=${source}`);
             } else {
                navigate(`/log-explorer?query=${podName}`);
             }
        } else {
            console.log(`${action} action triggered for pod: ${podName}`);
            // In a real app, you would use kubectl or an API to perform these actions.
        }
    };

    const getUsageColor = (usage: number): string => {
        if (usage >= 95) return 'text-red-500 font-bold animate-pulse';
        if (usage >= 80) return 'text-yellow-500 font-semibold';
        return 'text-gray-600 dark:text-gray-300';
    };

    if (loading && containers.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Container Insights</h2>
            
            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Containers</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Name</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Image</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Status</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-right">CPU</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-right">Memory</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-600 dark:text-gray-300">
                            {containers.map(c => (
                                <tr key={c.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs">{c.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{c.image}</td>
                                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                    <td className={`px-4 py-3 text-right ${getUsageColor(c.cpuUsage)}`}>{c.cpuUsage.toFixed(1)}%</td>
                                    <td className={`px-4 py-3 text-right`}>{c.memoryUsage.toFixed(0)} MB</td>
                                    <td className="px-4 py-3 space-x-2 text-center">
                                        <button onClick={() => handleContainerAction(c.name, 'Logs')} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold">Logs</button>
                                        <button onClick={() => handleContainerAction(c.name, 'Restart')} className="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 rounded text-white font-semibold">Restart</button>
                                        <button onClick={() => handleContainerAction(c.name, 'Stop')} className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white font-semibold">Stop</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Pods</h3>
                <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Name</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Namespace</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Status</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center">Restarts</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Age</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-600 dark:text-gray-300">
                            {pods.map(p => (
                                <tr key={p.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs">{p.name}</td>
                                    <td className="px-4 py-3">{p.namespace}</td>
                                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                                    <td className="px-4 py-3 text-center">{p.restarts}</td>
                                    <td className="px-4 py-3">{p.age}</td>
                                    <td className="px-4 py-3 space-x-2 text-center">
                                        <button onClick={() => handlePodAction(p.name, 'Logs')} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold">Logs</button>
                                        <button onClick={() => handlePodAction(p.name, 'Delete')} className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white font-semibold">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default ContainerInsights;