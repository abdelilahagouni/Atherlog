import * as React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/config';
import { Role, User } from '../types';
import { useToast } from '../hooks/useToast';
import InviteMemberModal from './InviteMemberModal';
import ConfirmRemoveMemberModal from './ConfirmRemoveMemberModal';
import UserDetailsModal from './UserDetailsModal';
import ApiKeyStatus from './ApiKeyStatus';
import SoundNotificationSettings from './SoundNotificationSettings';

const MemberManagement: React.FC = () => {
    const { currentUser, organizationMembers, updateMemberRole, removeMember } = useAuth();
    const { showToast } = useToast();
    const [isInviteModalOpen, setInviteModalOpen] = React.useState(false);
    const [memberToRemove, setMemberToRemove] = React.useState<User | null>(null);
    const [selectedMember, setSelectedMember] = React.useState<User | null>(null);
    const [isRemoving, setIsRemoving] = React.useState(false);

    const handleRoleChange = (userId: string, newRole: Role) => {
        const member = organizationMembers.find(u => u.id === userId);
        if (member) {
            updateMemberRole(userId, newRole);
            showToast(`${member.username}'s role updated to ${newRole}`, 'success');
        }
    };

    const handleRemoveConfirm = async () => {
        if (!memberToRemove) return;
        setIsRemoving(true);
        try {
            await removeMember(memberToRemove.id);
            showToast(`${memberToRemove.username} has been removed from the organization.`, 'success');
            setMemberToRemove(null);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsRemoving(false);
        }
    };
    
    const canManageMembers = currentUser?.role === Role.OWNER || currentUser?.role === Role.SUPER_ADMIN || currentUser?.role === Role.ADMIN;
    
    const roleIcons: Record<Role, React.ReactNode> = {
      [Role.OWNER]: <Icon name="crown" className="w-5 h-5 text-yellow-500" title="Owner" />,
      [Role.SUPER_ADMIN]: <Icon name="key" className="w-5 h-5 text-red-500" title="Super Admin" />,
      [Role.ADMIN]: <Icon name="settings" className="w-5 h-5 text-blue-500" title="Admin" />,
      [Role.ANALYST]: <Icon name="search-check" className="w-5 h-5 text-purple-500" title="Analyst" />,
      [Role.MEMBER]: <Icon name="user-circle" className="w-5 h-5 text-gray-500" title="Member" />,
    };

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="users-group" className="w-6 h-6" />
                        Organization Members
                    </h3>
                    {canManageMembers && (
                        <button 
                            onClick={() => setInviteModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
                        >
                            Invite Member
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Manage roles and access for members of your organization.</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">User</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Email</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Role</th>
                                {canManageMembers && <th className="px-4 py-3 text-right border-b border-gray-200 dark:border-gray-700">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {organizationMembers.map(member => (
                                <tr 
                                    key={member.id} 
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedMember(member)}
                                >
                                    <td className="px-4 py-3 font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                      {roleIcons[member.role]}
                                      {member.username}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{member.email}</td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={member.role}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleRoleChange(member.id, e.target.value as Role)
                                            }}
                                            className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md px-2 py-1 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                                            disabled={!canManageMembers || member.role === Role.OWNER || member.id === currentUser?.id}
                                        >
                                            {(Object.values(Role) as Role[]).map(role => (
                                                <option key={role} value={role} disabled={role === Role.OWNER}>
                                                    {role}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    {canManageMembers && (
                                        <td 
                                            className="px-4 py-3 text-right"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {member.role !== Role.OWNER && member.id !== currentUser?.id && (
                                                <button
                                                    onClick={() => setMemberToRemove(member)}
                                                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md"
                                                    title="Remove member"
                                                >
                                                    <Icon name="trash" className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isInviteModalOpen && <InviteMemberModal onClose={() => setInviteModalOpen(false)} />}
            {memberToRemove && (
                <ConfirmRemoveMemberModal
                    user={memberToRemove}
                    onClose={() => setMemberToRemove(null)}
                    onConfirm={handleRemoveConfirm}
                    isRemoving={isRemoving}
                />
            )}
            {selectedMember && (
                <UserDetailsModal 
                    user={selectedMember} 
                    onClose={() => setSelectedMember(null)} 
                />
            )}
        </>
    );
};


const EnterpriseAlerting: React.FC = () => {
    const [webhookUrl, setWebhookUrl] = React.useState('');
    const [slackUrl, setSlackUrl] = React.useState('');
    const [isTestingWebhook, setIsTestingWebhook] = React.useState(false);
    const [isTestingSlack, setIsTestingSlack] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const { showToast } = useToast();

    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/organization/settings`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setWebhookUrl(data.webhookUrl || '');
                    setSlackUrl(data.slackWebhookUrl || '');
                }
            } catch (err) {
                console.error('Failed to fetch org settings:', err);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/organization/settings`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
                },
                body: JSON.stringify({ 
                    slackWebhookUrl: slackUrl,
                    webhookUrl: webhookUrl
                })
            });
            if (response.ok) {
                showToast('Alerting settings saved successfully', 'success');
            } else {
                const data = await response.json();
                throw new Error(data.message);
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestWebhook = async () => {
        if (!webhookUrl) return;
        setIsTestingWebhook(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/test-webhook`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
                },
                body: JSON.stringify({ url: webhookUrl })
            });
            const data = await response.json();
            if (response.ok) showToast(data.message, 'success');
            else throw new Error(data.message);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsTestingWebhook(false);
        }
    };

    const handleTestSlack = async () => {
        if (!slackUrl) return;
        setIsTestingSlack(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/test-slack`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
                },
                body: JSON.stringify({ url: slackUrl })
            });
            const data = await response.json();
            if (response.ok) showToast(data.message, 'success');
            else throw new Error(data.message);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsTestingSlack(false);
        }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Icon name="bell" className="w-6 h-6 text-blue-500" />
                    Enterprise Alerting
                </h3>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : <Icon name="save" className="w-4 h-4" />}
                    Save Settings
                </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure external endpoints to receive real-time AI alerts.</p>
            
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Generic Webhook URL</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://your-api.com/webhook"
                            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                        />
                        <button 
                            onClick={handleTestWebhook}
                            disabled={isTestingWebhook || !webhookUrl}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isTestingWebhook ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : 'Test'}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Slack Webhook URL</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={slackUrl}
                            onChange={(e) => setSlackUrl(e.target.value)}
                            placeholder="https://hooks.slack.com/services/..."
                            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                        />
                        <button 
                            onClick={handleTestSlack}
                            disabled={isTestingSlack || !slackUrl}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isTestingSlack ? <Icon name="loader" className="w-4 h-4 animate-spin" /> : 'Test'}
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    );
};


const Settings: React.FC = () => {
  const { anomalyThreshold, setAnomalyThreshold } = useSettings();
  const [thresholdValue, setThresholdValue] = React.useState(anomalyThreshold);
  const [isSavingThreshold, setIsSavingThreshold] = React.useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    const fetchThreshold = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/organization/settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.anomalyThreshold !== undefined) {
                    setThresholdValue(data.anomalyThreshold);
                    setAnomalyThreshold(data.anomalyThreshold);
                }
            }
        } catch (err) {
            console.error('Failed to fetch threshold:', err);
        }
    };
    fetchThreshold();
  }, [setAnomalyThreshold]);

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setThresholdValue(value);
  };

  const handleThresholdChangeEnd = async () => {
    setIsSavingThreshold(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/organization/settings`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
            },
            body: JSON.stringify({ anomalyThreshold: thresholdValue })
        });
        if (response.ok) {
            setAnomalyThreshold(thresholdValue);
            showToast('Anomaly threshold updated', 'success');
        } else {
            const data = await response.json();
            throw new Error(data.message);
        }
    } catch (err: any) {
        showToast(err.message, 'error');
        setThresholdValue(anomalyThreshold); // Revert on error
    } finally {
        setIsSavingThreshold(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Organization Settings</h2>
      
       <Card>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Icon name="key" className="w-6 h-6" />
            API Key Management
        </h3>
        <ApiKeyStatus />
      </Card>
      
      <Card>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Anomaly Detection</h3>
            {isSavingThreshold && <Icon name="loader" className="w-5 h-5 animate-spin text-blue-500" />}
        </div>
        <div className="space-y-2">
            <label htmlFor="anomaly-threshold" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Anomaly Score Threshold: <span className="font-bold text-gray-900 dark:text-gray-100">{thresholdValue.toFixed(2)}</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Logs with an anomaly score above this value will be flagged. Lower values increase sensitivity. This setting applies to the entire organization.
            </p>
            <input 
                id="anomaly-threshold"
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={thresholdValue}
                onChange={handleThresholdChange}
                onMouseUp={handleThresholdChangeEnd}
                onTouchEnd={handleThresholdChangeEnd}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      </Card>

      <EnterpriseAlerting />

      <SoundNotificationSettings />

      <MemberManagement />

    </div>
  );
};

export default Settings;
