
import * as React from 'react';

const DEFAULT_THRESHOLD = 0.5;
const NOTIFICATION_SETTINGS_KEY = 'notificationSettings';

interface NotificationSettings {
    emailEnabled: boolean;
    smsEnabled: boolean;
    userIds: string[];
    anomalyThreshold: number;
}

interface SettingsContextType {
  anomalyThreshold: number;
  setAnomalyThreshold: (threshold: number) => void;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => void;
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined);

const getDefaultNotificationSettings = (): NotificationSettings => ({
    emailEnabled: true,
    smsEnabled: true,
    userIds: [],
    anomalyThreshold: 0.95,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [anomalyThreshold, setAnomalyThresholdState] = React.useState<number>(() => {
    try {
      const storedThreshold = localStorage.getItem('anomalyThreshold');
      return storedThreshold ? parseFloat(storedThreshold) : DEFAULT_THRESHOLD;
    } catch (error) {
      console.error('Error reading localStorage for anomalyThreshold', error);
      return DEFAULT_THRESHOLD;
    }
  });

  const [notificationSettings, setNotificationSettings] = React.useState<NotificationSettings>(() => {
    try {
        const storedSettings = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        if (storedSettings) {
            return { ...getDefaultNotificationSettings(), ...JSON.parse(storedSettings) };
        }
        return getDefaultNotificationSettings();
    } catch (error) {
        console.error('Error reading localStorage for notificationSettings', error);
        return getDefaultNotificationSettings();
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('anomalyThreshold', anomalyThreshold.toString());
    } catch (error) {
      console.error('Error writing to localStorage for anomalyThreshold', error);
    }
  }, [anomalyThreshold]);

  React.useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(notificationSettings));
    } catch (error) {
      console.error('Error writing to localStorage for notificationSettings', error);
    }
  }, [notificationSettings]);


  const setAnomalyThreshold = (threshold: number) => {
    const clampedThreshold = Math.max(0, Math.min(1, threshold));
    setAnomalyThresholdState(clampedThreshold);
  };

  const updateNotificationSettings = (updates: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({...prev, ...updates}));
  };

  return (
    <SettingsContext.Provider value={{ anomalyThreshold, setAnomalyThreshold, notificationSettings, updateNotificationSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};