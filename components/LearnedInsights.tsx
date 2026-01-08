import * as React from 'react';
import { getLearnedInsights, updateInsightNotes, deleteInsight } from '../services/insightsService';
import { LearnedInsight } from '../types';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';

const InsightCard: React.FC<{ 
    insight: LearnedInsight,
    onDelete: (id: string) => void,
    onUpdateNotes: (id: string, notes: string) => void,
}> = ({ insight, onDelete, onUpdateNotes }) => {
    const [notes, setNotes] = React.useState(insight.userNotes || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const { showToast } = useToast();

    const handleSaveNotes = async () => {
        setIsSaving(true);
        try {
            await updateInsightNotes(insight.id, notes);
            showToast('Notes updated successfully.', 'success');
            setIsEditing(false);
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const typeMap = {
        rca: { icon: 'sitemap', label: 'Root Cause Analysis', color: 'border-orange-500' },
        pattern: { icon: 'search-check', label: 'Discovered Pattern', color: 'border-blue-500' },
        playbook: { icon: 'shield-check', label: 'Remediation Playbook', color: 'border-green-500' },
    };
    const typeInfo = typeMap[insight.type];

    return (
        <Card className={`border-l-4 ${typeInfo.color}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <Icon name={typeInfo.icon} className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{typeInfo.label}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2">{insight.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Saved on {new Date(insight.timestamp).toLocaleString()}</p>
                </div>
                 <button 
                    onClick={() => onDelete(insight.id)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md"
                    title="Delete Insight"
                >
                    <Icon name="trash" className="w-5 h-5" />
                </button>
            </div>
            
            <p className="text-gray-700 dark:text-gray-200 mt-3 p-3 bg-black/5 dark:bg-white/5 rounded-md">{insight.summary}</p>

            <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Team Notes</h4>
                {isEditing ? (
                    <div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add your team's findings, resolution steps, or related ticket numbers..."
                            className="w-full h-24 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded font-semibold">Cancel</button>
                            <button onClick={handleSaveNotes} disabled={isSaving} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-50">
                                {isSaving ? 'Saving...' : 'Save Notes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div onClick={() => setIsEditing(true)} className="p-3 rounded-md bg-transparent hover:bg-black/5 dark:hover:bg-white/5 cursor-text min-h-[50px]">
                        {notes ? (
                            <p className="text-gray-700 dark:text-gray-200 text-sm whitespace-pre-wrap">{notes}</p>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm italic">Click to add notes...</p>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};

const LearnedInsights: React.FC = () => {
    const [insights, setInsights] = React.useState<LearnedInsight[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { showToast } = useToast();

    const fetchInsights = React.useCallback(async () => {
        const insightData = await getLearnedInsights();
        setInsights(insightData);
    }, []);

    React.useEffect(() => {
        setLoading(true);
        fetchInsights().finally(() => setLoading(false));
    }, [fetchInsights]);
    
    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this insight? This action cannot be undone.')) {
            try {
                await deleteInsight(id);
                setInsights(prev => prev.filter(i => i.id !== id));
                showToast('Insight deleted.', 'success');
            } catch (error: any) {
                showToast(error.message, 'error');
            }
        }
    };

    const handleUpdateNotes = (id: string, notes: string) => {
        setInsights(prev => prev.map(i => i.id === id ? { ...i, userNotes: notes } : i));
    };

    const filteredInsights = React.useMemo(() => {
        return insights.filter(insight =>
            insight.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            insight.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (insight.userNotes || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [insights, searchTerm]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Learned Insights</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">A persistent knowledge base of all AI-generated findings and team notes.</p>
            </div>
            
            <Card>
                 <div className="mb-4">
                    <label htmlFor="search-insights" className="sr-only">Search Insights</label>
                    <div className="relative">
                        <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            id="search-insights"
                            type="text"
                            placeholder="Search by title, summary, or notes..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                </div>
                
                {filteredInsights.length > 0 ? (
                    <div className="space-y-4">
                        {filteredInsights.map(insight => (
                            <InsightCard 
                                key={insight.id} 
                                insight={insight}
                                onDelete={handleDelete}
                                onUpdateNotes={handleUpdateNotes}
                            />
                        ))}
                    </div>
                ) : (
                     <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                        <Icon name="brain" className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" />
                        <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-gray-100">Your Knowledge Base is Empty</h3>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">
                           Save findings from Root Cause Analysis or Pattern Recognition to build your team's knowledge base.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default LearnedInsights;