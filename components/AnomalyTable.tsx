import * as React from 'react';
import { Anomaly, LogLevel } from '../types';

const LogLevelCell: React.FC<{ level: LogLevel }> = ({ level }) => {
    const levelColorMap: Record<LogLevel, string> = {
      [LogLevel.INFO]: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
      [LogLevel.WARN]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
      [LogLevel.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
      [LogLevel.DEBUG]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      [LogLevel.FATAL]: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${levelColorMap[level]}`}>
        {level}
      </span>
    );
  };

export const AnomalyTable: React.FC<{ anomalies: Anomaly[] }> = ({ anomalies }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300 mobile-card-view">
        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
          <tr>
            <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Timestamp</th>
            <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Level</th>
            <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Source</th>
            <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Message</th>
            <th scope="col" className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((anomaly) => (
            <tr key={anomaly.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap" data-label="Timestamp">{new Date(anomaly.timestamp).toLocaleString()}</td>
              <td className="px-6 py-4" data-label="Level"><LogLevelCell level={anomaly.level} /></td>
              <td className="px-6 py-4 font-mono" data-label="Source">{anomaly.source}</td>
              <td className="px-6 py-4 max-w-lg truncate" data-label="Message" title={anomaly.message}>{anomaly.message}</td>
              <td className="px-6 py-4 text-right font-semibold text-red-600 dark:text-red-400" data-label="Score">{anomaly.anomalyScore.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
