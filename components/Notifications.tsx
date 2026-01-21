import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { useToast } from '../hooks/useToast';
import { sendTestNotification } from '../services/notificationService';
import { Link } from 'react-router-dom';
import ToggleSwitch from './ui/ToggleSwitch';

const EmailNotifications: React.FC = () => {
    const { notificationSettings, updateNotificationSettings } = useSettings();
    const { organizationMembers } = useAuth();

    const eligibleUsers = React.useMemo(() => 
        organizationMembers.filter(u => 
            u.role === Role.OWNER ||
            u.role === Role.ADMIN ||
            u.role === Role.SUPER_ADMIN ||
            u.role === Role.ANALYST
        ),
    [organizationMembers]);
    
    const selectedUserIds = new Set(notificationSettings.userIds);

    const handleUserToggle = (userId: string) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        updateNotificationSettings({ userIds: Array.from(newSet) });
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Icon name="envelope" className="w-6 h-6" />
                    Email Notifications
                </h3>
                <ToggleSwitch 
                    enabled={notificationSettings.emailEnabled} 
                    onChange={(val) => updateNotificationSettings({ emailEnabled: val })}
                    label={notificationSettings.emailEnabled ? 'Enabled' : 'Disabled'}
                />
            </div>
            <div className={`transition-opacity duration-300 ${notificationSettings.emailEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select which users in your organization should receive email alerts for critical events. If none are selected, all eligible roles will be notified by default.</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {eligibleUsers.map(user => (
                        <div key={user.id} className="flex items-center p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                            <label className="flex items-center w-full cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={selectedUserIds.has(user.id)}
                                    onChange={() => handleUserToggle(user.id)}
                                    className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-blue-600 focus:ring-blue-600"
                                />
                                <span className="ml-3 text-gray-800 dark:text-gray-200">{user.username}</span>
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({user.role})</span>
                                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 font-mono">{user.notificationEmail || user.email}</span>
                            </label>
                        </div>
                    ))}
                </div>
                {notificationSettings.userIds.length > 0 && (
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {notificationSettings.userIds.length} recipient(s) selected.
                    </p>
                )}
                 {eligibleUsers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No eligible users (Admins, Analysts, etc.) in this organization to notify.</p>
                )}
            </div>
        </Card>
    );
}

const SmsTroubleshooting: React.FC = () => {
    return (
        <>
            <div className="p-4 bg-blue-100/50 dark:bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                    <Icon name="live" className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-blue-800 dark:text-blue-200">Solving Geo-Permission Errors</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300/80 mt-1">
                            If you see an error like <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded-sm">Permission to send an SMS has not been enabled...</code>, you need to enable permissions for that country in your Twilio account settings.
                        </p>
                        <a 
                            href="https://console.twilio.com/ui/messaging/settings/geo-permissions" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Go to Twilio Geo-Permissions &rarr;
                        </a>
                    </div>
                </div>
            </div>
             <div className="p-4 bg-blue-100/50 dark:bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                    <Icon name="phone" className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-blue-800 dark:text-blue-200">Solving "Invalid 'From' Number" Errors</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300/80 mt-1">
                            If you see an error like <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded-sm">'From' number is not a Twilio phone number...</code>, it means the <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded-sm">TWILIO_PHONE_NUMBER</code> in your <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded-sm">.env</code> file must be a number you have purchased from Twilio.
                        </p>
                        <a 
                            href="https://console.twilio.com/ui/phone-numbers/incoming" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Manage Twilio Phone Numbers &rarr;
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
};


const SmsNotifications: React.FC = () => {
    const { notificationSettings, updateNotificationSettings } = useSettings();
    const { currentUser } = useAuth();

    const canReceiveSms = currentUser && (
        currentUser.role === Role.OWNER ||
        currentUser.role === Role.ADMIN ||
        currentUser.role === Role.SUPER_ADMIN ||
        currentUser.role === Role.ANALYST
    );
    
    if (!canReceiveSms) {
        return null; // Don't show SMS settings for users who can't receive them
    }
    
    const hasPhone = currentUser && currentUser.phone;

    return (
        <div className="space-y-4">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="phone" className="w-6 h-6" />
                        SMS Notifications
                    </h3>
                    <ToggleSwitch 
                        enabled={notificationSettings.smsEnabled} 
                        onChange={(val) => updateNotificationSettings({ smsEnabled: val })}
                        label={notificationSettings.smsEnabled ? 'Enabled' : 'Disabled'}
                    />
                </div>
                <div className={`transition-opacity duration-300 ${notificationSettings.smsEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    {!hasPhone ? (
                        <div className="p-4 bg-yellow-100/50 dark:bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                            <Icon name="exclamation-triangle" className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-yellow-800 dark:text-yellow-200">Phone Number Required</p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300/80 mt-1">
                                    To receive SMS alerts, you must add a verified phone number to your account.
                                </p>
                                <Link to="/account" className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                                    Go to My Account to add phone number &rarr;
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            SMS alerts will be sent to your configured phone number: <strong className="text-gray-800 dark:text-gray-200 font-mono">{currentUser.phone}</strong>.
                        </p>
                    )}
                </div>
            </Card>
            <SmsTroubleshooting />
        </div>
    )
}


const Notifications: React.FC = () => {
    const { notificationSettings, updateNotificationSettings } = useSettings();
    const [threshold, setThreshold] = React.useState(notificationSettings.anomalyThreshold);
    const [isTesting, setIsTesting] = React.useState(false);
    const { showToast } = useToast();

    React.useEffect(() => {
        setThreshold(notificationSettings.anomalyThreshold);
    }, [notificationSettings.anomalyThreshold]);

    const handleThresholdChangeEnd = () => {
        updateNotificationSettings({ anomalyThreshold: threshold });
    };

    const handleSendTest = async () => {
        setIsTesting(true);
        try {
            await sendTestNotification();
            showToast('Test alert triggered. Check your configured email/phone and backend console for logs.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to send test alert.', 'error');
        } finally {
            setIsTesting(false);
        }
    };


    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Notification Settings</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Configure when and how your organization receives alerts for critical system events.</p>
            </div>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Trigger Conditions</h3>
                    <button
                        onClick={handleSendTest}
                        disabled={isTesting}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {isTesting && <Icon name="loader" className="w-5 h-5 animate-spin" />}
                        {isTesting ? 'Sending...' : 'Send Test Alert'}
                    </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Notifications are only sent for logs with level <span className="font-bold text-purple-700 dark:text-purple-400">FATAL</span> that also exceed the anomaly score threshold defined below.
                </p>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                        Minimum Anomaly Score to Trigger Alert: <span className="font-bold text-gray-900 dark:text-gray-100">{threshold.toFixed(2)}</span>
                    </label>
                    <input 
                        type="range" 
                        min="0.8" 
                        max="1" 
                        step="0.01" 
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        onMouseUp={handleThresholdChangeEnd}
                        onTouchEnd={handleThresholdChangeEnd}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </Card>

            <EmailNotifications />
            <SmsNotifications />
            
        </div>
    );
};

export default Notifications;