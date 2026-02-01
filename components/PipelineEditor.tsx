
import * as React from 'react';
import { useState } from 'react';
import { Icon } from './ui/Icon';
import { RuleBuilder } from './RuleBuilder';

export interface PipelineData {
    id?: string;
    name: string;
    description: string;
    rules: any[];
    enabled: boolean;
}

interface PipelineEditorProps {
    pipeline?: PipelineData;
    onSave: (data: PipelineData) => void;
    onCancel: () => void;
}

export const PipelineEditor: React.FC<PipelineEditorProps> = ({ pipeline, onSave, onCancel }) => {
    const [formData, setFormData] = useState<PipelineData>(
        pipeline || {
            name: '',
            description: '',
            rules: [],
            enabled: true
        }
    );

    const handleAddRule = () => {
        setFormData(prev => ({
            ...prev,
            rules: [...prev.rules, { type: 'mask', config: { patterns: ['email'] } }]
        }));
    };

    const handleUpdateRule = (index: number, updatedRule: any) => {
        const newRules = [...formData.rules];
        newRules[index] = updatedRule;
        setFormData(prev => ({ ...prev, rules: newRules }));
    };

    const handleDeleteRule = (index: number) => {
        setFormData(prev => ({
            ...prev,
            rules: prev.rules.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {pipeline ? 'Edit Pipeline' : 'Create New Pipeline'}
                        </h2>
                        <p className="text-sm text-gray-500">Define how logs should be processed</p>
                    </div>
                    <button 
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                        <Icon name="x" className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Pipeline Name</label>
                            <input 
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                placeholder="e.g. Production PII Scrubber"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea 
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition h-20 resize-none"
                                placeholder="What does this pipeline do?"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Icon name="code" className="w-5 h-5 text-blue-500" />
                                Processing Rules
                            </h3>
                            <button 
                                type="button"
                                onClick={handleAddRule}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Icon name="plus" className="w-4 h-4" />
                                Add Rule
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {formData.rules.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                                    <p className="text-gray-400 text-sm">No rules defined yet.</p>
                                    <p className="text-gray-400 text-xs mt-1">Add a rule to start filtering or masking data.</p>
                                </div>
                            ) : (
                                formData.rules.map((rule, idx) => (
                                    <RuleBuilder 
                                        key={idx} 
                                        rule={rule} 
                                        onChange={(updated) => handleUpdateRule(idx, updated)}
                                        onDelete={() => handleDeleteRule(idx)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 rounded-b-2xl">
                    <button 
                        onClick={onCancel}
                        className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={!formData.name}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                    >
                        <Icon name="save" className="w-4 h-4" />
                        Save Pipeline
                    </button>
                </div>
            </div>
        </div>
    );
};
