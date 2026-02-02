import * as React from 'react';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { Icon } from './ui/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { generateFiltersFromQuery, getApiKeyStatus } from '../services/geminiService';
import { useToast } from '../hooks/useToast';
import { GeneratedFilters } from '../types';

interface Command {
  id: string;
  type: 'navigation' | 'action' | 'ai';
  title: string;
  icon: string;
  action: () => void;
  keywords?: string;
}

const CommandPalette: React.FC = () => {
  const { isOpen, closePalette } = useCommandPalette();
  const { toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; } | null>(null);

  const commands: Command[] = React.useMemo(() => [
    { id: 'nav-dashboard', type: 'navigation', title: 'Go to Dashboard', icon: 'dashboard', action: () => navigate('/dashboard'), keywords: 'home main' },
    { id: 'nav-visual-analytics', type: 'navigation', title: 'Go to Visual Analytics', icon: 'sparkles', action: () => navigate('/visual-analytics'), keywords: 'ai insights charts' },
    { id: 'nav-anomalies', type: 'navigation', title: 'Go to Live Anomalies', icon: 'live', action: () => navigate('/live-anomalies'), keywords: 'logs stream' },
    { id: 'nav-history', type: 'navigation', title: 'Go to Alert History', icon: 'history', action: () => navigate('/alert-history') },
    { id: 'nav-parser', type: 'navigation', title: 'Go to Visual Parser', icon: 'visual-parser', action: () => navigate('/visual-log-parser'), keywords: 'image ocr' },
    { id: 'nav-detector', type: 'navigation', title: 'Go to Object Detector', icon: 'object-scan', action: () => navigate('/live-object-detector'), keywords: 'camera scan' },
    { id: 'nav-insights', type: 'navigation', title: 'Go to Container Insights', icon: 'containers', action: () => navigate('/container-insights') },
    { id: 'nav-alerting', type: 'navigation', title: 'Go to Alerting Rules', icon: 'bell', action: () => navigate('/alerting') },
    { id: 'nav-notifications', type: 'navigation', title: 'Go to Notifications', icon: 'envelope', action: () => navigate('/notifications') },
    { id: 'nav-settings', type: 'navigation', title: 'Go to Org Settings', icon: 'settings', action: () => navigate('/settings'), keywords: 'organization members' },
    { id: 'nav-audit', type: 'navigation', title: 'Go to Audit Logs', icon: 'list-bullet', action: () => navigate('/audit-logs'), keywords: 'security trail' },
    { id: 'nav-billing', type: 'navigation', title: 'Go to Billing & Plan', icon: 'billing', action: () => navigate('/billing') },
    { id: 'nav-account', type: 'navigation', title: 'Go to My Account', icon: 'user-circle', action: () => navigate('/account'), keywords: 'profile' },
    { id: 'action-theme', type: 'action', title: 'Toggle Theme', icon: 'sun', action: toggleTheme, keywords: 'dark light mode' },
    { id: 'action-logout', type: 'action', title: 'Logout', icon: 'logout', action: logout, keywords: 'sign out' },
  ], [navigate, toggleTheme, logout]);

  const filteredCommands = React.useMemo(() => {
    if (!searchTerm.trim() || searchTerm.startsWith('>')) {
      return commands;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return commands.filter(cmd => 
      cmd.title.toLowerCase().includes(lowerSearch) || 
      (cmd.keywords && cmd.keywords.includes(lowerSearch))
    );
  }, [searchTerm, commands]);

  const isAiQuery = searchTerm.startsWith('>');

  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setIsAiLoading(false);
    } else {
        getApiKeyStatus().then(setApiStatus);
    }
    setActiveIndex(0);
  }, [isOpen]);

  const handleAiSearch = async () => {
    const query = searchTerm.substring(1).trim();
    if (!query) return;

    setIsAiLoading(true);
    if (!apiStatus || (!apiStatus.geminiConfigured && !apiStatus.openaiConfigured)) {
        showToast('No AI provider is configured. Please set an API key in Org Settings.', 'error');
        setIsAiLoading(false);
        return;
    }
    const provider = apiStatus.openaiConfigured ? 'openai' : 'gemini';
    try {
        const filters: GeneratedFilters = await generateFiltersFromQuery(query, provider);
        const queryParams = new URLSearchParams();
        if (filters.keyword) queryParams.set('keyword', filters.keyword);
        if (filters.levels) queryParams.set('levels', filters.levels.join(','));
        if (filters.sources) queryParams.set('sources', filters.sources.join(','));
        
        navigate(`/live-anomalies?${queryParams.toString()}`);
        showToast('AI filters applied!', 'success');
        closePalette();
    } catch (err: any) {
        showToast(err.message || 'Failed to generate AI filters.', 'error');
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % (isAiQuery ? 1 : filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + (isAiQuery ? 1 : filteredCommands.length)) % (isAiQuery ? 1 : filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isAiQuery) {
        handleAiSearch();
      } else if (filteredCommands[activeIndex]) {
        filteredCommands[activeIndex].action();
        closePalette();
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[15vh]" onClick={closePalette}>
      <div 
        className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden animate-slide-up-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <Icon name={isAiLoading ? "loader" : "search"} className={`w-5 h-5 text-gray-400 dark:text-gray-500 ${isAiLoading ? 'animate-spin' : ''}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search... (e.g., '> show fatal errors')"
            autoFocus
            className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none text-lg"
          />
           <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-1.5 py-0.5">
            ESC
           </div>
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-2">
            {isAiQuery ? (
                <div 
                    onClick={handleAiSearch}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${activeIndex === 0 ? 'bg-black/5 dark:bg-white/5' : ''}`}
                >
                    <Icon name="sparkles" className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">AI Log Search</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{searchTerm.substring(1)}</p>
                    </div>
                </div>
            ) : filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, index) => (
                    <div
                        key={cmd.id}
                        onClick={() => { cmd.action(); closePalette(); }}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${index === activeIndex ? 'bg-black/5 dark:bg-white/5' : ''}`}
                    >
                        <Icon name={cmd.icon} className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-800 dark:text-gray-200">{cmd.title}</span>
                    </div>
                ))
            ) : (
                <p className="text-center p-4 text-gray-500 dark:text-gray-400">No results found.</p>
            )}
        </div>
        <div className="p-2 text-xs text-center border-t border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-black/20">
            <strong>Tip:</strong> Start your query with <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded-sm">&gt;</code> to perform an AI-powered log search.
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;