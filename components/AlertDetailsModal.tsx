import * as React from 'react';
import { AlertHistoryEntry } from '../types';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';

interface AlertDetailsModalProps {
  alert: AlertHistoryEntry;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value: string | number | undefined; className?: string }> = ({ label, value, className = '' }) => (
  <div>
    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`text-md text-gray-800 dark:text-gray-200 break-words ${className}`}>{value ?? 'N/A'}</p>
  </div>
);

const AlertDetailsModal: React.FC<AlertDetailsModalProps> = ({ alert, onClose }) => {
  const { showToast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(alert.log.message);
    showToast('Log message copied to clipboard!', 'success');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="list-bullet" className="w-7 h-7 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Alert Details</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
                <DetailItem label="Alert Timestamp" value={new Date(alert.timestamp).toLocaleString()} />
                <DetailItem label="Log Level" value={alert.log.level} />
                <DetailItem label="Log Source" value={alert.log.source} className="font-mono" />
                <DetailItem label="Anomaly Score" value={alert.log.anomalyScore?.toFixed(3)} />
                <DetailItem label="Log Timestamp" value={new Date(alert.log.timestamp).toLocaleString()} />
            </div>
            <div>
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Full Log Message</p>
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white font-semibold transition-colors"
                    >
                        <Icon name="copy" className="w-4 h-4" />
                        Copy Log
                    </button>
                 </div>
                 <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300">
                    <pre className="whitespace-pre-wrap break-words">{alert.log.message}</pre>
                 </div>
            </div>
        </div>

        <div className="p-4 mt-auto border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-right rounded-b-2xl flex-shrink-0">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

// FIX: Added a default export for the AlertDetailsModal component.
export default AlertDetailsModal;