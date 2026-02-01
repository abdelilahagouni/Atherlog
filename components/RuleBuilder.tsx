
import * as React from 'react';
import { Icon } from './ui/Icon';

interface RuleBuilderProps {
    rule: { type: string; config: any };
    onChange: (updatedRule: { type: string; config: any }) => void;
    onDelete: () => void;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({ rule, onChange, onDelete }) => {
    
    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        // Reset config based on type to avoid invalid states
        const newConfig = newType === 'mask' ? { patterns: ['email', 'credit_card'] } 
                        : newType === 'filter' ? { field: 'level', operator: 'eq', value: 'ERROR' }
                        : {};
        
        onChange({ type: newType, config: newConfig });
    };

    const handleConfigChange = (key: string, value: any) => {
        onChange({ 
            ...rule, 
            config: { ...rule.config, [key]: value } 
        });
    };

    const handlePatternToggle = (pattern: string) => {
        const currentPatterns = rule.config.patterns || [];
        const newPatterns = currentPatterns.includes(pattern)
            ? currentPatterns.filter((p: string) => p !== pattern)
            : [...currentPatterns, pattern];
        handleConfigChange('patterns', newPatterns);
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:border-blue-400">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                        rule.type === 'mask' ? 'bg-purple-100 text-purple-600' :
                        rule.type === 'filter' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                    }`}>
                        <Icon name={rule.type === 'mask' ? 'lock' : rule.type === 'filter' ? 'filter' : 'zap'} className="w-5 h-5" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Rule Type</label>
                        <select 
                            value={rule.type} 
                            onChange={handleTypeChange}
                            className="mt-1 block w-full bg-transparent border-none text-gray-900 dark:text-white font-semibold focus:ring-0 p-0 cursor-pointer"
                        >
                            <option value="mask">PII Masking</option>
                            <option value="filter">Log Filter</option>
                            <option value="enrich">Enrichment (Coming Soon)</option>
                        </select>
                    </div>
                </div>
                <button 
                    onClick={onDelete}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <Icon name="x" className="w-5 h-5" />
                </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                {rule.type === 'mask' && (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data to Mask</label>
                        <div className="flex flex-wrap gap-2">
                            {['email', 'credit_card', 'ipv4', 'ssn', 'phone'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => handlePatternToggle(type)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                                        rule.config.patterns?.includes(type)
                                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    {type.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500">Selected patterns will be replaced with [MASKED] in real-time.</p>
                    </div>
                )}

                {rule.type === 'filter' && (
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Field</label>
                            <select 
                                value={rule.config.field}
                                onChange={(e) => handleConfigChange('field', e.target.value)}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                            >
                                <option value="level">Log Level</option>
                                <option value="source">Source</option>
                                <option value="message">Message Body</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Operator</label>
                            <select 
                                value={rule.config.operator}
                                onChange={(e) => handleConfigChange('operator', e.target.value)}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
                            >
                                <option value="eq">Equals</option>
                                <option value="neq">Not Equals</option>
                                <option value="contains">Contains</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Value</label>
                            <input 
                                type="text"
                                value={rule.config.value}
                                onChange={(e) => handleConfigChange('value', e.target.value)}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2"
                                placeholder="e.g. ERROR"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
