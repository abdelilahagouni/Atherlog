import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { soundNotificationService, SoundConfig } from '../services/soundNotificationService';

const SoundNotificationSettings: React.FC = () => {
    const { showToast } = useToast();
    const [config, setConfig] = React.useState<SoundConfig>(soundNotificationService.getConfig());
    const [isTesting, setIsTesting] = React.useState<'fatal' | 'critical' | 'warning' | null>(null);

    const handleConfigChange = (newConfig: Partial<SoundConfig>) => {
        const updatedConfig = { ...config, ...newConfig };
        setConfig(updatedConfig);
        soundNotificationService.updateConfig(updatedConfig);
    };

    const handleTestSound = async (type: 'fatal' | 'critical' | 'warning') => {
        setIsTesting(type);
        try {
            await soundNotificationService.testSound(type);
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} sound test played`, 'success');
        } catch (error) {
            showToast('Failed to play test sound', 'error');
        } finally {
            setIsTesting(null);
        }
    };

    const availableSounds = soundNotificationService.getAvailableSounds();

    return (
        <Card>
            <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                    <Icon name="volume-2" className="w-6 h-6 text-blue-500" />
                    Sound Notifications
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure WhatsApp-like sound alerts for different error levels. 
                    Sounds will play when new logs matching your criteria are detected.
                </p>
            </div>

            <div className="space-y-6">
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Icon name="bell" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">Enable Sound Notifications</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Master toggle for all sound alerts
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => handleConfigChange({ enabled: !config.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            config.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                config.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>

                {/* Volume Control */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Volume: {Math.round(config.volume * 100)}%
                    </label>
                    <div className="flex items-center gap-3">
                        <Icon name="volume-off" className="w-4 h-4 text-gray-400" />
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.volume * 100}
                            onChange={(e) => handleConfigChange({ volume: parseInt(e.target.value) / 100 })}
                            disabled={!config.enabled}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:opacity-50"
                        />
                        <Icon name="volume-up" className="w-4 h-4 text-gray-400" />
                    </div>
                </div>

                {/* Individual Sound Settings */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Alert Types</h4>
                    
                    {availableSounds.map((sound) => {
                        const isEnabled = config[`${sound.type}Error` as keyof SoundConfig] as boolean;
                        const isCurrentlyTesting = isTesting === sound.type;
                        
                        return (
                            <div key={sound.type} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-3 flex-1">
                                    <Icon 
                                        name={sound.type === 'fatal' ? 'alert-triangle' : sound.type === 'critical' ? 'alert-circle' : 'alert'} 
                                        className={`w-5 h-5 ${
                                            sound.type === 'fatal' ? 'text-purple-500' : 
                                            sound.type === 'critical' ? 'text-red-500' : 'text-yellow-500'
                                        }`} 
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                                            {sound.type} Errors
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {sound.description}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleTestSound(sound.type)}
                                        disabled={!config.enabled || isCurrentlyTesting}
                                        className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isCurrentlyTesting ? (
                                            <Icon name="loader" className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Icon name="play" className="w-3 h-3" />
                                        )}
                                        Test
                                    </button>
                                    <button
                                        onClick={() => handleConfigChange({ [`${sound.type}Error`]: !isEnabled })}
                                        disabled={!config.enabled}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                            isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                isEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Browser Compatibility Note */}
                <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                        <Icon name="info" className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-300">
                            <div className="font-medium mb-1">Browser Compatibility</div>
                            <div>
                                Sound notifications work in all modern browsers. Some browsers may require user interaction 
                                before playing sounds. If you don't hear sounds, try clicking anywhere on the page first.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default SoundNotificationSettings;