
import * as React from 'react';
import { Link } from 'react-router-dom';
import { AiDiscovery } from '../types';
import { Icon } from './ui/Icon';
import { Card } from './ui/Card';

interface AiDiscoveryCardProps {
  discovery: AiDiscovery;
  onDismiss: () => void;
  style?: React.CSSProperties;
}

const AiDiscoveryCard: React.FC<AiDiscoveryCardProps> = ({ discovery, onDismiss, style }) => {
  const typeMap = {
    TREND: { icon: 'chart-bar', color: 'border-purple-500' },
    NEW_ERROR: { icon: 'exclamation-triangle', color: 'border-yellow-500' },
    SPIKE: { icon: 'arrow-trending-up', color: 'border-red-500' },
    ANOMALY_CLUSTER: { icon: 'anomaly', color: 'border-orange-500' },
  };

  const typeInfo = typeMap[discovery.type] || { icon: 'brain', color: 'border-gray-500' };

  const investigationLink = () => {
    const params = new URLSearchParams();
    const { keyword, source, level } = discovery.investigationFilters;
    if (keyword) params.set('keyword', keyword);
    if (source) params.set('sources', source);
    if (level) params.set('levels', level);
    
    // Add a time range of the last hour for context
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    params.set('startDate', oneHourAgo.toISOString());
    params.set('endDate', now.toISOString());
    
    return `/log-explorer?${params.toString()}`;
  };

  return (
    <Card className={`h-full flex flex-col border-l-4 ${typeInfo.color} animate-fade-in-scale-up`} style={style}>
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <Icon name={typeInfo.icon as string} className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">{discovery.title}</h4>
            </div>
            <button
                onClick={onDismiss}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Dismiss insight"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <div className="flex-1 my-3 space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">{discovery.summary}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Implication:</span> {discovery.implication}</p>
        </div>
        
        <div className="mt-auto">
            <Link 
                to={investigationLink()} 
                className="w-full inline-block text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors text-sm"
            >
                Investigate
            </Link>
        </div>
    </Card>
  );
};

// Add some new icons for the discovery card
Icon.customIcons = {
    ...Icon.customIcons,
    'chart-bar': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    'arrow-trending-up': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-.625m3.75.625V3.375" /></svg>,
};

export default AiDiscoveryCard;
