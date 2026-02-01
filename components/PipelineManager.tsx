// PipelineManager.tsx - UI for managing log processing pipelines and PII masking
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { API_BASE_URL } from '../utils/config';
import { useAuth } from '../contexts/AuthContext';
import { PipelineEditor, PipelineData } from './PipelineEditor';

interface PipelineRule {
    type: 'mask' | 'filter' | 'enrich' | 'parse';
    config: any;
}

interface LogPipeline {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    rules: PipelineRule[];
    enabled: boolean;
    order: number;
}

const PipelineManager: React.FC = () => {
    const [pipelines, setPipelines] = useState<LogPipeline[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingPipeline, setEditingPipeline] = useState<LogPipeline | undefined>(undefined);
    
    const { token } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/logs/pipelines`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setPipelines(data);
        } catch (error) {
            console.error('Failed to fetch pipelines:', error);
            showToast('Failed to load pipelines', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTogglePipeline = async (pipelineId: string, enabled: boolean) => {
        try {
            const response = await fetch(`${API_BASE_URL}/logs/pipelines/${pipelineId}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });

            if (response.ok) {
                setPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, enabled } : p));
                showToast(`Pipeline ${enabled ? 'enabled' : 'disabled'}`, 'success');
            }
        } catch (error) {
            showToast('Failed to update pipeline', 'error');
        }
    };

    const handleSavePipeline = async (data: PipelineData) => {
        try {
            const method = data.id ? 'PUT' : 'POST';
            const url = data.id 
                ? `${API_BASE_URL}/logs/pipelines/${data.id}`
                : `${API_BASE_URL}/logs/pipelines`;

            const response = await fetch(url, {
                method,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to save');

            const savedPipeline = await response.json();
            
            if (method === 'POST') {
                setPipelines([...pipelines, savedPipeline]);
                showToast('Pipeline created successfully', 'success');
            } else {
                setPipelines(pipelines.map(p => p.id === savedPipeline.id ? savedPipeline : p));
                showToast('Pipeline updated successfully', 'success');
            }
            
            setIsEditorOpen(false);
            setEditingPipeline(undefined);
        } catch (error) {
            console.error('Save failed:', error);
            showToast('Failed to save pipeline', 'error');
        }
    };

    const openCreateModal = () => {
        setEditingPipeline(undefined);
        setIsEditorOpen(true);
    };

    const openEditModal = (pipeline: LogPipeline) => {
        setEditingPipeline(pipeline);
        setIsEditorOpen(true);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="pipeline" className="w-7 h-7 text-blue-500" />
                        Log Pipelines
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Process and sanitize logs before they are indexed. Enable PII masking for compliance.
                    </p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/30"
                >
                    <Icon name="plus" className="w-5 h-5" />
                    New Pipeline
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="grid gap-6">
                    {pipelines.length === 0 ? (
                        <Card className="p-12 text-center border-dashed">
                            <Icon name="pipeline" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No pipelines configured</h3>
                            <p className="text-gray-500 mb-6">Start by creating a pipeline to mask PII or filter logs.</p>
                            <button 
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                            >
                                <Icon name="plus" className="w-5 h-5" />
                                Create Pipeline
                            </button>
                        </Card>
                    ) : (
                        pipelines.map(pipeline => (
                            <Card key={pipeline.id} className="p-5 overflow-hidden border-l-4 border-l-blue-500 transition-all hover:shadow-md">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{pipeline.name}</h3>
                                            {pipeline.enabled ? (
                                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">Active</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full font-medium">Inactive</span>
                                            )}
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400">{pipeline.description}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer" 
                                                checked={pipeline.enabled}
                                                onChange={(e) => handleTogglePipeline(pipeline.id, e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                        <button 
                                            onClick={() => openEditModal(pipeline)}
                                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                        >
                                            <Icon name="edit" className="w-5 h-5" />
                                        </button>
                                        <button className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            <Icon name="trash" className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="mt-6">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <Icon name="code" className="w-4 h-4" />
                                        Processing Rules
                                    </h4>
                                    <div className="space-y-3">
                                        {pipeline.rules.map((rule, idx) => (
                                            <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                                <div className={`p-2 rounded-lg ${
                                                    rule.type === 'mask' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' :
                                                    rule.type === 'filter' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                                                    'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                                                }`}>
                                                    <Icon name={rule.type === 'mask' ? 'lock' : rule.type === 'filter' ? 'filter' : 'zap'} className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-900 dark:text-white capitalize">{rule.type}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {rule.type === 'mask' && `Masking: ${rule.config.patterns?.join(', ') || 'None'}`}
                                                        {rule.type === 'filter' && `Condition: ${rule.config.field} ${rule.config.operator} ${rule.config.value}`}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Pipeline Editor Modal */}
            {isEditorOpen && (
                <PipelineEditor 
                    pipeline={editingPipeline} 
                    onSave={handleSavePipeline} 
                    onCancel={() => setIsEditorOpen(false)} 
                />
            )}

            {/* Security Alert */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex gap-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg h-fit">
                    <Icon name="shield" className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-bold text-blue-900 dark:text-blue-300">Enterprise Data Protection</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                        AetherLog uses military-grade AES-256 encryption for log storage. 
                        Pipelines ensure sensitive data never leaves your environment unmasked, 
                        helping you meet GDPR, HIPAA, and PCI-DSS requirements.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PipelineManager;
