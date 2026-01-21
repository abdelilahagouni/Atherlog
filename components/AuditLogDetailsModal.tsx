import * as React from 'react';
import { AuditLogEntry } from '../types';
import { Icon } from './ui/Icon';

interface AuditLogDetailsModalProps {
  log: AuditLogEntry;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value: string | number | undefined; className?: string }> = ({ label, value, className = '' }) => (
  <div>
    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`text-md text-gray-800 dark:text-gray-200 break-words ${className}`}>{value ?? 'N/A'}</p>
  </div>
);

const AuditLogDetailsModal: React.FC<AuditLogDetailsModalProps> = ({ log, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="list-bullet" className="w-7 h-7 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Audit Log Details</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                <DetailItem label="Timestamp" value={new Date(log.timestamp).toLocaleString()} />
                <DetailItem label="Action" value={log.action} />
                <DetailItem label="Actor" value={log.username} />
                <DetailItem label="Actor User ID" value={log.userId} />
            </div>
            <div>
                 <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Event Details</p>
                 <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300">
                    <pre className="whitespace-pre-wrap break-words">
                        {JSON.stringify(log.details, null, 2)}
                    </pre>
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

export default AuditLogDetailsModal;