import * as React from 'react';
import { LogEntry, LogFilter } from '../types';
import { Icon } from './ui/Icon';

interface LogEntryDetailProps {
  log: LogEntry;
  onAddFilter: (filter: LogFilter) => void;
}

const isJsonString = (str: string) => {
    try {
        const parsed = JSON.parse(str);
        return typeof parsed === 'object' && parsed !== null;
    } catch (e) {
        return false;
    }
};

const JsonViewer: React.FC<{ data: object; onAddFilter: (filter: LogFilter) => void }> = ({ data, onAddFilter }) => {
    return (
        <div className="space-y-1">
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex items-start">
                    <button
                        onClick={() => onAddFilter({ key, value: String(value) })}
                        className="flex items-center gap-1 text-purple-600 dark:text-purple-400 flex-shrink-0 hover:underline"
                        title={`Filter by ${key}: ${value}`}
                    >
                        <Icon name="plus-circle" className="w-3 h-3" />
                        <span className="font-semibold">{key}:</span>
                    </button>
                    <span className="mx-2 text-gray-400 dark:text-gray-500">=</span>
                    <span className="text-gray-800 dark:text-gray-200 break-all">
                        {typeof value === 'string' ? `"${value}"` : String(value)}
                    </span>
                </div>
            ))}
        </div>
    );
};


const LogEntryDetail: React.FC<LogEntryDetailProps> = ({ log, onAddFilter }) => {
    if (isJsonString(log.message)) {
        try {
            const data = JSON.parse(log.message);
            return <JsonViewer data={data} onAddFilter={onAddFilter} />;
        } catch (e) {
             // Fallback for safety, though isJsonString should prevent this
            return <span className="whitespace-pre-wrap">{log.message}</span>;
        }
    }

    return <span className="whitespace-pre-wrap">{log.message}</span>;
};

export default LogEntryDetail;