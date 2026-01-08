import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { Navigate } from 'react-router-dom';
import { Role } from '../types';
import { useToast } from '../hooks/useToast';
import ToggleSwitch from './ui/ToggleSwitch';

const DetailItem: React.FC<{ label: string; value: string | number | undefined; fullWidth?: boolean }> = ({ label, value, fullWidth = false }) => (
  <div className={fullWidth ? 'sm:col-span-2' : ''}>
    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-md text-gray-900 dark:text-gray-100 font-semibold truncate">{String(value)}</p>
  </div>
);

const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                active 
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
        >
            {children}
        </button>
    );
};

const ProfileTab: React.FC = () => {
    const { currentUser } = useAuth();
    if (!currentUser) return null;

    return (
        <Card>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                <DetailItem label="Primary Email" value={currentUser.email} />
                <DetailItem label="Salary" value={`$${currentUser.salary.toLocaleString('en-US')}`} />
                <DetailItem label="Hire Date" value={new Date(currentUser.hireDate).toLocaleDateString()} />
                <DetailItem label="User ID" value={currentUser.id} />
            </div>
        </Card>
    );
};

const NotificationsTab: React.FC = () => {
    const { currentUser, updateUser } = useAuth();
    const { showToast } = useToast();
    const [notificationEmail, setNotificationEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (currentUser) {
            setNotificationEmail(currentUser.notificationEmail || '');
            setPhone(currentUser.phone || '');
        }
    }, [currentUser]);
    
    if (!currentUser) return null;
    
    const canReceiveNotifications = currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN || currentUser.role === Role.ANALYST || currentUser.role === Role.OWNER;

    const handleSaveContactInfo = async () => {
        setIsSaving(true);
        try {
            await updateUser(currentUser.id, { 
                notificationEmail: notificationEmail || undefined,
                phone: phone || undefined 
            });
            showToast('Contact information updated successfully!', 'success');
        } catch (error) {
            // Error toast is already shown by the auth context
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!canReceiveNotifications) {
        return (
            <Card>
                 <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Settings</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400">Your role ({currentUser.role}) is not configured to receive system alerts.</p>
            </Card>
        )
    }

    return (
         <Card>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Contact Information</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Critical alerts will be sent to the contacts below. If a field is left blank, the system will use your default contact information.
            </p>
            <div className="space-y-4">
                <div>
                    <label htmlFor="notification-email" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Notification Email Address
                    </label>
                    <div className="relative">
                        <Icon name="envelope" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            id="notification-email"
                            type="email"
                            placeholder={currentUser.email}
                            value={notificationEmail}
                            onChange={(e) => setNotificationEmail(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="notification-phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Notification Phone Number (for SMS)
                    </label>
                    <div className="relative">
                        <Icon name="phone" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            id="notification-phone"
                            type="tel"
                            placeholder="e.g., +15551234567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                </div>
                <div className="pt-2 flex justify-end">
                    <button
                        onClick={handleSaveContactInfo}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving && <Icon name="loader" className="w-5 h-5 animate-spin" />}
                        {isSaving ? 'Saving...' : 'Save Contact Info'}
                    </button>
                </div>
            </div>
        </Card>
    );
}

const SecurityTab: React.FC = () => {
    const { showToast } = useToast();
    const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);

    const handleFeatureClick = () => {
        showToast("This feature is for demonstration purposes only.", "info");
    };

    return (
        <Card>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Security Settings</h3>
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Change Password</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">It's a good practice to periodically update your password.</p>
                    <button onClick={handleFeatureClick} className="mt-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-semibold">Change Password</button>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Two-Factor Authentication (2FA)</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add an extra layer of security to your account.</p>
                    <div className="mt-3">
                         <ToggleSwitch
                            enabled={twoFactorEnabled}
                            onChange={() => {
                                setTwoFactorEnabled(!twoFactorEnabled);
                                handleFeatureClick();
                            }}
                            label={twoFactorEnabled ? "2FA is Enabled" : "2FA is Disabled"}
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
};


const MyAccount: React.FC = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = React.useState('profile');
    
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Account</h2>

            <Card>
                <div className="flex items-start gap-6">
                    <Icon name="user-circle" className="w-24 h-24 text-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{currentUser.username}</h3>
                        <p className="text-lg text-gray-600 dark:text-gray-300">{currentUser.jobTitle}</p>
                        <span className="mt-2 inline-block px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
                            {currentUser.role}
                        </span>
                    </div>
                </div>
            </Card>
            
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>Profile</TabButton>
                <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>Notifications</TabButton>
                <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')}>Security</TabButton>
            </div>
            
            <div className="animate-slide-up-fade-in">
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'notifications' && <NotificationsTab />}
                {activeTab === 'security' && <SecurityTab />}
            </div>
        </div>
    );
};

export default MyAccount;