import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { DeploymentCheckpoint } from '../types';
import { getDeploymentHistory } from '../services/deploymentService';

const CheckpointCard: React.FC<{ checkpoint: DeploymentCheckpoint }> = ({ checkpoint }) => {
    const { showToast } = useToast();
    const handleRollback = () => {
        showToast('Rollback functionality is for demonstration purposes only.', 'info');
    };

    return (
        <div className="relative pl-8">
            <div className="absolute top-0 left-0 h-full w-0.5 bg-gray-300 dark:bg-gray-700"></div>
            <div className={`absolute top-1 left-[-9px] w-5 h-5 rounded-full border-4 ${checkpoint.isCurrent ? 'bg-blue-500 border-white dark:border-[#1C1C1E]' : 'bg-gray-300 dark:bg-gray-600 border-white dark:border-[#1C1C1E]'}`}></div>
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{checkpoint.version}</h3>
                    {checkpoint.isCurrent && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">Current</span>}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{new Date(checkpoint.timestamp).toLocaleString()}</p>
                <p className="text-gray-700 dark:text-gray-300 mb-4">{checkpoint.description}</p>
                {!checkpoint.isCurrent && (
                    <button
                        onClick={handleRollback}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-semibold text-gray-800 dark:text-gray-200 transition-colors"
                    >
                        <Icon name="rollback" className="w-4 h-4" />
                        Rollback to this version
                    </button>
                )}
            </div>
        </div>
    );
};


const DeploymentHistory: React.FC = () => {
    const [history, setHistory] = React.useState<DeploymentCheckpoint[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const data = await getDeploymentHistory();
            setHistory(data);
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Icon name="loader" className="w-10 h-10 animate-spin" /></div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Deployment History</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    A historical log of application versions and deployments. You can view changes and simulate rolling back to a previous checkpoint.
                </p>
            </div>

            <Card>
                <div className="relative">
                    {history.map(checkpoint => (
                        <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default DeploymentHistory;