import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { getIncidentById, updateIncidentStatus, addIncidentNote } from '../services/incidentService';
import { Incident, IncidentStatus, LogEntry, ActivityLogEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';

const TriageStepView: React.FC<{ step: Incident['playbook']['triageSteps'][0] }> = ({ step }) => {
    const { showToast } = useToast();
    const handleCopy = () => {
        if (step.command) {
            navigator.clipboard.writeText(step.command);
            showToast('Command copied to clipboard!', 'success');
        }
    };

    return (
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold">
                {step.step}
            </div>
            <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{step.action}</p>
                {step.command && (
                    <div className="mt-2 p-2 bg-gray-800 dark:bg-black/50 rounded-lg flex items-center gap-2 font-mono text-sm">
                        <span className="text-gray-400">$</span>
                        <code className="text-white flex-1 overflow-x-auto custom-scrollbar">{step.command}</code>
                        <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/20">
                            <Icon name="copy" className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const LogLine: React.FC<{ log: LogEntry; isTarget?: boolean }> = ({ log, isTarget }) => (
    <div className={`p-2 rounded-md font-mono text-xs ${isTarget ? 'bg-red-500/10 border border-red-500/20' : 'bg-black/5 dark:bg-white/5'}`}>
        <span className="text-gray-500 dark:text-gray-400 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
        <span className="font-bold mr-2 text-sky-600 dark:text-sky-400">{log.source}</span>
        <span>{log.message}</span>
    </div>
);


const IncidentDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    
    const [incident, setIncident] = React.useState<Incident | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [newNote, setNewNote] = React.useState('');

    React.useEffect(() => {
        if (!id) {
            navigate('/incidents');
            return;
        }
        const fetchIncident = async () => {
            try {
                setError(null);
                const data = await getIncidentById(id);
                setIncident(data);
            } catch (err: any) {
                console.error('Failed to fetch incident:', err);
                setError(err.message || 'Failed to load incident');
                showToast(err.message || 'Failed to load incident', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchIncident();
    }, [id, navigate, showToast]);

    const handleStatusChange = async (newStatus: IncidentStatus) => {
        if (!id) return;
        setIsUpdating(true);
        try {
            const updatedIncident = await updateIncidentStatus(id, newStatus);
            setIncident(updatedIncident);
            showToast(`Incident status updated to ${newStatus}`, 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleAddNote = async () => {
        if (!id || !newNote.trim() || !currentUser) return;
        setIsUpdating(true);
        try {
            const updatedIncident = await addIncidentNote(id, newNote, currentUser);
            setIncident(updatedIncident);
            setNewNote('');
            showToast('Note added successfully', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Icon name="alert-triangle" className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Error Loading Incident</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">{error}</p>
                <div className="flex gap-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        Retry
                    </button>
                    <button
                        onClick={() => navigate('/incidents')}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded-lg font-semibold transition-colors"
                    >
                        Back to Incidents
                    </button>
                </div>
            </div>
        );
    }

    if (!incident) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Icon name="alert-triangle" className="w-16 h-16 text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Incident Not Found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                    This incident may have been resolved or doesn't exist. FATAL logs need to be generated first for incidents to appear.
                </p>
                <button
                    onClick={() => navigate('/alert-center')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                    Go to Alert Center
                </button>
            </div>
        );
    }
    
    const { title, status, severity, createdAt, rcaResult, playbook, triggeringLog, activityLog } = incident;

    const severityColors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
    const statusMap: Record<IncidentStatus, { color: string; icon: string; }> = {
        [IncidentStatus.INVESTIGATING]: { color: 'text-yellow-600 dark:text-yellow-400', icon: 'search' },
        [IncidentStatus.ACKNOWLEDGED]: { color: 'text-blue-600 dark:text-blue-400', icon: 'play' },
        [IncidentStatus.RESOLVED]: { color: 'text-green-600 dark:text-green-400', icon: 'check-circle' },
    };


    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                 <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Opened on {new Date(createdAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Severity:</span>
                            <div className="flex gap-1.5" title={`Severity ${severity} of 5`}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className={`w-5 h-2 rounded-full ${i < severity ? severityColors[i] : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                ))}
                            </div>
                        </div>
                        <div className={`flex items-center gap-2 font-semibold ${statusMap[status].color}`}>
                            <Icon name={statusMap[status].icon} className="w-5 h-5" />
                            <span>{status}</span>
                        </div>
                    </div>
                 </div>
                 <div className="mt-4 flex gap-2">
                    {status === IncidentStatus.INVESTIGATING && <button onClick={() => handleStatusChange(IncidentStatus.ACKNOWLEDGED)} disabled={isUpdating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg">Acknowledge</button>}
                    {status === IncidentStatus.ACKNOWLEDGED && <button onClick={() => handleStatusChange(IncidentStatus.RESOLVED)} disabled={isUpdating} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg">Mark as Resolved</button>}
                    {status === IncidentStatus.RESOLVED && <button onClick={() => handleStatusChange(IncidentStatus.INVESTIGATING)} disabled={isUpdating} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg">Re-Open Incident</button>}
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Analysis & Playbook */}
                <div className="space-y-8">
                    <Card>
                        <h3 className="text-xl font-semibold mb-3">AI Summary</h3>
                        <p className="text-gray-700 dark:text-gray-200">{rcaResult.summary}</p>
                    </Card>
                    <Card>
                         <h3 className="text-xl font-semibold mb-3">Triggering Log</h3>
                         <LogLine log={triggeringLog} isTarget />
                    </Card>
                     <Card>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">AI Remediation Playbook</h3>
                        <div className="space-y-4">
                            {playbook.triageSteps.map(step => <TriageStepView key={step.step} step={step} />)}
                        </div>
                         <div className="mt-6">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Escalation Path</h4>
                            <div className="p-3 bg-yellow-100/50 dark:bg-yellow-500/10 border-l-4 border-yellow-500 rounded-r-lg">
                                <p className="text-yellow-800 dark:text-yellow-200 text-sm">{playbook.escalationPath}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Activity */}
                <div className="space-y-8">
                     <Card>
                        <h3 className="text-xl font-semibold mb-4">Activity & Notes</h3>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {activityLog.map(note => (
                                <div key={note.id} className="flex items-start gap-3">
                                    <Icon name="user-circle" className="w-8 h-8 text-gray-400 flex-shrink-0" />
                                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{note.username}</span>
                                            <span className="text-gray-500 dark:text-gray-400">{new Date(note.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{note.note}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                         <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                             <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note or update..." className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-600" rows={3}></textarea>
                             <div className="text-right mt-2">
                                <button onClick={handleAddNote} disabled={isUpdating || !newNote.trim()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50">Add Note</button>
                             </div>
                        </div>
                    </Card>
                </div>
            </div>

        </div>
    );
};

export default IncidentDetail;