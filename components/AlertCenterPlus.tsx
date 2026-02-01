import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { getAlertEvents, generateAlertProposal } from '../services/logService';
import { LogLevel } from '../types';

type AlertType = 'fatal' | 'anomaly_high';

type AlertEvent = {
  id: string;
  organizationId: string;
  type: AlertType;
  severity: 'CRITICAL' | 'HIGH' | string;
  source: string | null;
  logId: string | null;
  createdAt: string;
  sent: boolean;
  suppressed: boolean;
  log?: {
    id: string;
    timestamp: string;
    level: LogLevel;
    message: string;
    source: string;
    anomalyScore?: number;
  } | null;
  proposal?: any;
};

const Pill: React.FC<{ label: string; className: string }> = ({ label, className }) => (
  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${className}`}>{label}</span>
);

const levelPillClass = (level?: LogLevel) => {
  switch (level) {
    case LogLevel.FATAL:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300';
    case LogLevel.ERROR:
      return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300';
    case LogLevel.WARN:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300';
    case LogLevel.INFO:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300';
    case LogLevel.DEBUG:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const severityPillClass = (severity?: string) => {
  if (severity === 'CRITICAL') return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300';
  if (severity === 'HIGH') return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const AlertDetailsModal: React.FC<{
  alert: AlertEvent;
  onClose: () => void;
  onGenerateProposal: (id: string) => Promise<void>;
  generating: boolean;
}> = ({ alert, onClose, onGenerateProposal, generating }) => {
  const log = alert.log;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="bell" className="w-7 h-7 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Alert Center+</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex flex-wrap gap-2">
            <Pill label={alert.type} className="bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200" />
            <Pill label={String(alert.severity)} className={severityPillClass(String(alert.severity))} />
            <Pill label={alert.sent ? 'sent' : 'suppressed'} className={alert.sent ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'} />
            {log?.level && <Pill label={log.level} className={levelPillClass(log.level)} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">{new Date(alert.createdAt).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Source</p>
              <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">{alert.source ?? log?.source ?? 'N/A'}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Message</p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300">
              <pre className="whitespace-pre-wrap break-words">{log?.message ?? 'N/A'}</pre>
            </div>
          </div>

          {alert.proposal && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white/50 dark:bg-black/10">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-gray-900 dark:text-gray-100">AI Proposal</p>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{alert.proposal?.createdAt ? new Date(alert.proposal.createdAt).toLocaleString() : ''}</span>
              </div>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                {alert.proposal?.rca?.summary && (
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">RCA Summary</p>
                    <p>{String(alert.proposal.rca.summary)}</p>
                  </div>
                )}
                {Array.isArray(alert.proposal?.rca?.nextSteps) && alert.proposal.rca.nextSteps.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">Next Steps</p>
                    <ol className="list-decimal list-inside space-y-1">
                      {alert.proposal.rca.nextSteps.map((s: any, idx: number) => (
                        <li key={idx}>{String(s)}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 mt-auto border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex-shrink-0 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onGenerateProposal(alert.id)}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? <Icon name="loader" className="w-5 h-5 animate-spin" /> : <Icon name="sparkles" className="w-5 h-5" />}
            Generate AI Proposal
          </button>
        </div>
      </div>
    </div>
  );
};

const AlertCenterPlus: React.FC = () => {
  const { showToast } = useToast();
  const [events, setEvents] = React.useState<AlertEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [type, setType] = React.useState<string>('');
  const [severity, setSeverity] = React.useState<string>('');
  const [sent, setSent] = React.useState<string>('');

  const [selected, setSelected] = React.useState<AlertEvent | null>(null);
  const [generating, setGenerating] = React.useState(false);

  const fetchEvents = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlertEvents({ type: type || undefined, severity: severity || undefined, sent: sent || undefined, limit: 200 });
      setEvents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [type, severity, sent]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleGenerateProposal = async (id: string) => {
    try {
      setGenerating(true);
      const resp = await generateAlertProposal(id);
      const proposal = resp?.proposal;
      setSelected(prev => (prev ? { ...prev, proposal } : prev));
      setEvents(prev => prev.map(e => (e.id === id ? { ...e, proposal } : e)));
      showToast('AI proposal generated.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to generate proposal.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Icon name="alert-triangle" className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Failed to Load Alerts</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Alert Center+</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time alerts with sent/suppressed tracking and AI remediation proposals.</p>
      </div>

      <div className="p-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600"
          >
            <option value="">All</option>
            <option value="fatal">fatal</option>
            <option value="anomaly_high">anomaly_high</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Severity</label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600"
          >
            <option value="">All</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-2">Delivery</label>
          <select
            value={sent}
            onChange={e => setSent(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600"
          >
            <option value="">All</option>
            <option value="true">Sent</option>
            <option value="false">Suppressed</option>
          </select>
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button
            onClick={fetchEvents}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
              <tr>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Created</th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Type</th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Severity</th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Delivery</th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Source</th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Message</th>
                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-center">AI</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr
                  key={ev.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => setSelected(ev)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(ev.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4"><Pill label={ev.type} className="bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200" /></td>
                  <td className="px-6 py-4"><Pill label={String(ev.severity)} className={severityPillClass(String(ev.severity))} /></td>
                  <td className="px-6 py-4"><Pill label={ev.sent ? 'sent' : 'suppressed'} className={ev.sent ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'} /></td>
                  <td className="px-6 py-4 font-mono">{ev.source ?? ev.log?.source ?? 'N/A'}</td>
                  <td className="px-6 py-4 max-w-md truncate" title={ev.log?.message || ''}>{ev.log?.message || ''}</td>
                  <td className="px-6 py-4 text-center">
                    {ev.proposal ? <Icon name="check-circle" className="w-5 h-5 text-green-500 inline" /> : <Icon name="sparkles" className="w-5 h-5 text-gray-400 inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {events.length === 0 && (
            <div className="text-center py-12">
              <Icon name="history" className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">No Alerts Found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting filters or ingest a dataset with FATAL/high anomaly logs.</p>
            </div>
          )}
        </div>
      </Card>

      {selected && (
        <AlertDetailsModal
          alert={selected}
          onClose={() => setSelected(null)}
          onGenerateProposal={handleGenerateProposal}
          generating={generating}
        />
      )}
    </div>
  );
};

export default AlertCenterPlus;
