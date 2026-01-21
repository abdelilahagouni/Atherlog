import * as React from 'react';
import { AlertRule, LogLevel } from '../types';
import { getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from '../services/logService';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import ToggleSwitch from './ui/ToggleSwitch';
import { useToast } from '../hooks/useToast';
import AlertRuleModal from './AlertRuleModal';

const renderConditionString = (condition: AlertRule['condition']): string => {
    if (condition.type === 'keyword') {
        const parts: string[] = [];
        if (condition.keyword) parts.push(`message contains "${condition.keyword}"`);
        if (condition.level) parts.push(`level is ${condition.level}`);
        if (condition.source) parts.push(`source is ${condition.source}`);
        return `Log where ${parts.join(' and ')}`;
    }
    if (condition.type === 'threshold') {
        const parts: string[] = [];
        if (condition.level) parts.push(`level is ${condition.level}`);
        if (condition.source) parts.push(`source is ${condition.source}`);
        const filterPart = parts.length > 0 ? ` with ${parts.join(' and ')}` : '';
        return `Count of logs${filterPart} > ${condition.count} in ${condition.timeWindowMinutes} minutes`;
    }
    return 'Invalid condition';
};

const ChannelBadge: React.FC<{ channel: 'email' | 'sms' }> = ({ channel }) => {
    const channelMap = {
        email: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
        sms: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
    };
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${channelMap[channel]}`}>
            {channel}
        </span>
    );
};

const Alerting: React.FC = () => {
    const [rules, setRules] = React.useState<AlertRule[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AlertRule | null>(null);
    const { showToast } = useToast();

    const fetchRules = React.useCallback(async () => {
        try {
            const rulesData = await getAlertRules();
            setRules(rulesData);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    React.useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleToggleRule = async (ruleId: string) => {
        const rule = rules.find(r => r.id === ruleId);
        if (!rule) return;
        try {
            await updateAlertRule(ruleId, { enabled: !rule.enabled });
            showToast(`Rule "${rule.name}" ${!rule.enabled ? 'enabled' : 'disabled'}.`, 'success');
            fetchRules();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleCreateNew = () => {
        setEditingRule(null);
        setIsModalOpen(true);
    };

    const handleEdit = (rule: AlertRule) => {
        setEditingRule(rule);
        setIsModalOpen(true);
    };

    const handleDelete = async (ruleId: string) => {
        if (window.confirm('Are you sure you want to delete this rule?')) {
            try {
                await deleteAlertRule(ruleId);
                showToast('Rule deleted successfully.', 'success');
                fetchRules();
            } catch (err: any) {
                showToast(err.message, 'error');
            }
        }
    };

    const handleSaveRule = async (ruleData: Omit<AlertRule, 'id'> | AlertRule) => {
        try {
            if ('id' in ruleData) {
                await updateAlertRule(ruleData.id, ruleData);
                showToast('Rule updated successfully!', 'success');
            } else {
                await createAlertRule(ruleData);
                showToast('Rule created successfully!', 'success');
            }
            setIsModalOpen(false);
            fetchRules();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Alerting Rules</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Create and manage custom rules to trigger notifications for specific events.</p>
                </div>
                <button 
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-2"
                >
                    <Icon name="plus-circle" className="w-5 h-5" />
                    Create New Rule
                </button>
            </div>

            <Card>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Rule Name</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Condition</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Channel</th>
                                <th className="px-6 py-3 text-center border-b border-gray-200 dark:border-gray-700">Status</th>
                                <th className="px-6 py-3 text-center border-b border-gray-200 dark:border-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map(rule => (
                                <tr key={rule.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{rule.name}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{renderConditionString(rule.condition)}</td>
                                    <td className="px-6 py-4"><ChannelBadge channel={rule.channel} /></td>
                                    <td className="px-6 py-4 text-center">
                                        <ToggleSwitch enabled={rule.enabled} onChange={() => handleToggleRule(rule.id)} />
                                    </td>
                                    <td className="px-6 py-4 text-center space-x-2">
                                        <button onClick={() => handleEdit(rule)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-md"><Icon name="edit" className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-md"><Icon name="trash" className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {rules.length === 0 && (
                        <div className="text-center py-12">
                            <Icon name="bell" className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">No Custom Rules Found</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Click "Create New Rule" to get started.
                            </p>
                        </div>
                    )}
                </div>
            </Card>
            {isModalOpen && (
                <AlertRuleModal 
                    rule={editingRule} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSaveRule}
                />
            )}
        </div>
    );
};

export default Alerting;
