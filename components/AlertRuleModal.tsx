import * as React from 'react';
import { AlertRule, LogLevel } from '../types';
import { Icon } from './ui/Icon';
import { sources } from '../services/logService';

interface AlertRuleModalProps {
    rule: AlertRule | null;
    onClose: () => void;
    onSave: (rule: Omit<AlertRule, 'id'> | AlertRule) => void;
}

const AlertRuleModal: React.FC<AlertRuleModalProps> = ({ rule, onClose, onSave }) => {
    const [name, setName] = React.useState(rule?.name || '');
    const [conditionType, setConditionType] = React.useState<'keyword' | 'threshold'>(rule?.condition.type || 'keyword');
    const [keyword, setKeyword] = React.useState(rule?.condition.keyword || '');
    const [level, setLevel] = React.useState<LogLevel | ''>(rule?.condition.level || '');
    const [source, setSource] = React.useState(rule?.condition.source || '');
    const [count, setCount] = React.useState(rule?.condition.count || 10);
    const [timeWindow, setTimeWindow] = React.useState(rule?.condition.timeWindowMinutes || 5);
    const [channel, setChannel] = React.useState<'email' | 'sms'>(rule?.channel || 'email');
    const [enabled, setEnabled] = React.useState(rule?.enabled ?? true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const commonData = { name, channel, enabled };
        
        const conditionData: AlertRule['condition'] = conditionType === 'keyword'
            ? { type: 'keyword', keyword: keyword || undefined, level: level || undefined, source: source || undefined }
            : { type: 'threshold', count, timeWindowMinutes: timeWindow, level: level || undefined, source: source || undefined };
        
        const finalRuleData = { ...commonData, condition: conditionData };

        if (rule) {
            onSave({ ...rule, ...finalRuleData });
        } else {
            onSave(finalRuleData);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="edit" className="w-6 h-6" />
                        {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        <div>
                            <label htmlFor="rule-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Rule Name</label>
                            <input id="rule-name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., High Volume of Auth Errors" className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600"/>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Condition Type</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2"><input type="radio" value="keyword" checked={conditionType === 'keyword'} onChange={() => setConditionType('keyword')} className="text-blue-600"/> Keyword Match</label>
                                <label className="flex items-center gap-2"><input type="radio" value="threshold" checked={conditionType === 'threshold'} onChange={() => setConditionType('threshold')} className="text-blue-600"/> Threshold</label>
                            </div>
                        </div>

                        {/* Condition Fields */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                           <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trigger WHEN a log matches:</p>
                           {conditionType === 'keyword' && (
                                <div>
                                    <label htmlFor="keyword" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Message Contains (optional)</label>
                                    <input id="keyword" type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g., timeout" className="w-full bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600 text-sm"/>
                                </div>
                           )}
                           {conditionType === 'threshold' && (
                                <div className="flex items-center gap-4">
                                    <div>
                                        <label htmlFor="count" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Count is greater than</label>
                                        <input id="count" type="number" value={count} onChange={e => setCount(parseInt(e.target.value))} min="1" className="w-24 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600 text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="timewindow" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">within a time window of (minutes)</label>
                                        <input id="timewindow" type="number" value={timeWindow} onChange={e => setTimeWindow(parseInt(e.target.value))} min="1" className="w-24 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600 text-sm" />
                                    </div>
                                </div>
                           )}

                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="level" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Log Level (optional)</label>
                                    <select id="level" value={level} onChange={e => setLevel(e.target.value as LogLevel)} className="w-full bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600 text-sm">
                                        <option value="">Any Level</option>
                                        {Object.values(LogLevel).map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="source" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Log Source (optional)</label>
                                    <select id="source" value={source} onChange={e => setSource(e.target.value)} className="w-full bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600 text-sm">
                                        <option value="">Any Source</option>
                                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                           </div>
                        </div>

                        <div>
                            <label htmlFor="channel" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Notification Channel</label>
                            <select id="channel" value={channel} onChange={e => setChannel(e.target.value as 'email' | 'sms')} className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600">
                                <option value="email">Email</option>
                                <option value="sms">SMS</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-end items-center gap-4 mt-auto flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors">
                            {rule ? 'Save Changes' : 'Create Rule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AlertRuleModal;