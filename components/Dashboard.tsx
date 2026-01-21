import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Anomaly, LogLevel, LogSummary, AiDiscovery } from '../types';
import { getAnomalies, getLogSummary, getHistoricalLogs } from '../services/logService';
import { discoverInsights, getApiKeyStatus } from '../services/geminiService';
import { Card } from './ui/Card';
import { AnomalyChart } from './AnomalyChart';
import { AnomalyTable } from './AnomalyTable';
import { Icon } from './ui/Icon';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import AiDiscoveryCard from './AiDiscoveryCard';

const AiDiscoveriesSection: React.FC<{
  discoveries: AiDiscovery[],
  onDismiss: (id: string) => void,
  isLoading: boolean
}> = ({ discoveries, onDismiss, isLoading }) => {
  
  const header = (
    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
      <Icon name="sparkles" className="w-6 h-6 text-[var(--accent-color-gold)]" />
      Proactive AI Insights
    </h3>
  );

  if (isLoading) {
    return (
      <div>
        {header}
        <Card>
          <div className="flex items-center gap-3">
            <Icon name="loader" className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-gray-600 dark:text-gray-300">AI is analyzing recent logs for proactive insights...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (discoveries.length === 0) {
    return (
       <div>
        {header}
        <Card>
          <div className="flex items-center gap-3">
            <Icon name="shield-check" className="w-6 h-6 text-green-500" />
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-200">All Clear!</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">AI analysis complete. No new critical insights found.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
       {header}
        <div className="flex gap-6 pb-4 -mx-4 px-4 overflow-x-auto custom-scrollbar horizontal-scroll">
            {discoveries.map((discovery, index) => (
                <div key={discovery.id} className="flex-shrink-0 w-full sm:w-[400px]">
                    <AiDiscoveryCard 
                        discovery={discovery} 
                        onDismiss={() => onDismiss(discovery.id)}
                        style={{ animationDelay: `${index * 100}ms`}}
                    />
                </div>
            ))}
        </div>
    </div>
  );
};


const Dashboard: React.FC = () => {
  const { anomalyThreshold } = useSettings();
  const { currentOrganization } = useAuth();
  const [anomalies, setAnomalies] = React.useState<Anomaly[]>([]);
  const [logSummary, setLogSummary] = React.useState<LogSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [aiDiscoveries, setAiDiscoveries] = React.useState<AiDiscovery[]>([]);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [anomaliesData, summaryData] = await Promise.all([
          getAnomalies(anomalyThreshold),
          getLogSummary(),
        ]);
        setAnomalies(anomaliesData);
        setLogSummary(summaryData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchAiInsights = async () => {
        const status = await getApiKeyStatus();
        if(!status.geminiConfigured && !status.openaiConfigured) return;

        setIsAiLoading(true);
        try {
            const logs = await getHistoricalLogs(200);
            if (logs.length > 20) {
                const discoveries = await discoverInsights(logs);
                setAiDiscoveries(discoveries);
            }
        } catch (error) {
            console.error("Failed to fetch AI discoveries:", error);
        } finally {
            setIsAiLoading(false);
        }
    };

    fetchData();
    fetchAiInsights();
  }, [anomalyThreshold]);
  
  const handleChartClick = (payload: any) => {
    if (payload && payload.activePayload && payload.activePayload.length > 0) {
      const dataPoint = payload.activePayload[0].payload as LogSummary;
      const hourString = dataPoint.hour; // "HH:00"
      
      const now = new Date();
      const [hour] = hourString.split(':');
      
      // Find the corresponding date from the last 24h range
      const targetDate = new Date(now);
      targetDate.setHours(parseInt(hour, 10), 0, 0, 0);

      // If the hour is in the future relative to now, it must be from yesterday
      if (targetDate > now) {
          targetDate.setDate(targetDate.getDate() - 1);
      }

      const endDate = new Date(targetDate);
      endDate.setHours(targetDate.getHours(), 59, 59, 999);

      // Use the full ISO string for reliability
      navigate(`/log-explorer?startDate=${targetDate.toISOString()}&endDate=${endDate.toISOString()}`);
    }
  };

  const handleDismissDiscovery = (id: string) => {
    setAiDiscoveries(current => current.filter(d => d.id !== id));
  };

  const totalLogs = logSummary.reduce((sum, item) => sum + item.total, 0);
  const totalAnomalies = logSummary.reduce((sum, item) => sum + item.anomalies, 0);
  const totalErrors = logSummary.reduce((sum, item) => sum + item.errors, 0);
  const totalFatals = logSummary.reduce((sum, item) => sum + item.fatals, 0);
  
  const errorRate = totalLogs > 0 ? ((totalErrors + totalFatals) / totalLogs) * 100 : 0;
  const alertsTriggered = totalFatals;
  const anomalyRate = totalLogs > 0 ? (totalAnomalies / totalLogs) * 100 : 0;

  const logsQuota = currentOrganization?.plan.quotas.logsPerMonth ?? Infinity;
  const isOverQuota = totalLogs > logsQuota;

  const cardHoverEffect = "transition-transform duration-200 hover:scale-[1.03] hover:shadow-xl dark:hover:shadow-blue-500/10 touch-feedback";


  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 skeleton" />
        
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-6 rounded-lg">
              <div className="flex items-center">
                <div className="w-14 h-14 rounded-lg skeleton mr-4" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 skeleton" />
                  <div className="h-8 w-20 skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 rounded-lg">
            <div className="h-6 w-48 skeleton mb-4" />
            <div className="h-80 skeleton" />
          </div>
          <div className="lg:col-span-1 glass-card p-6 rounded-lg">
            <div className="h-6 w-32 skeleton mb-4" />
            <div className="h-80 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full skeleton" />
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="glass-card p-6 rounded-lg">
          <div className="h-6 w-40 skeleton mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>

      {isOverQuota && (
        <div className="p-4 bg-red-100/50 dark:bg-red-500/20 text-red-800 dark:text-red-200 rounded-lg flex items-center justify-between border border-red-500/20">
          <div className="flex items-center gap-3">
            <Icon name="anomaly" className="w-6 h-6" />
            <div>
              <p className="font-bold">Log Quota Exceeded</p>
              <p className="text-sm">You've used {totalLogs.toLocaleString()} of {logsQuota.toLocaleString()} logs this month. To continue ingesting logs, please upgrade your plan.</p>
            </div>
          </div>
          <Link to="/billing" className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-semibold whitespace-nowrap">
            Upgrade Plan
          </Link>
        </div>
      )}

      <AiDiscoveriesSection discoveries={aiDiscoveries} onDismiss={handleDismissDiscovery} isLoading={isAiLoading} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
            <div className="flex items-center">
                <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 mr-4">
                    <Icon name="logs" className="w-8 h-8" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Logs (24h)</p>
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalLogs.toLocaleString()}</p>
                </div>
            </div>
        </Card>
        <Link to="/live-anomalies">
            <Card className={cardHoverEffect}>
                <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-500 dark:text-red-300 mr-4">
                        <Icon name="anomaly" className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Anomalies Found</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalAnomalies.toLocaleString()}</p>
                    </div>
                </div>
            </Card>
        </Link>
        <Link to={`/log-explorer?levels=${LogLevel.ERROR},${LogLevel.FATAL}`}>
            <Card className={cardHoverEffect}>
                <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-500 dark:text-orange-300 mr-4">
                        <Icon name="percent" className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Error Rate</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{errorRate.toFixed(2)}%</p>
                    </div>
                </div>
            </Card>
        </Link>
        <Link to="/alert-history">
            <Card className={cardHoverEffect}>
                <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-500 dark:text-purple-300 mr-4">
                        <Icon name="bell" className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Alerts Triggered (24h)</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{alertsTriggered.toLocaleString()}</p>
                    </div>
                </div>
            </Card>
        </Link>
        <Card>
            <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-500 dark:text-green-300 mr-4">
                    <Icon name="health" className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">System Health</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{(100 - anomalyRate).toFixed(2)}%</p>
                </div>
            </div>
        </Card>
        <Card>
            <div className="flex items-center">
                <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-500/20 text-yellow-500 dark:text-yellow-300 mr-4">
                    <Icon name="source" className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Log Sources</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">5</p>
                </div>
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card className="cursor-pointer hover:shadow-blue-500/10">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Log & Anomaly Trends (24h)</h3>
                <div className="h-80">
                    <AnomalyChart data={logSummary} onDataClick={handleChartClick} />
                </div>
            </Card>
        </div>
        <div className="lg:col-span-1">
             <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Anomaly Rate</h3>
                <div className="h-80 flex flex-col items-center justify-center">
                    <div className="relative w-40 h-40">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path className="text-black/10 dark:text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                            <path className="text-red-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${anomalyRate.toFixed(2)}, 100`} strokeLinecap="round"></path>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{anomalyRate.toFixed(2)}%</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">Anomalous</span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
      </div>
      
      <div>
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Anomalies</h3>
            <AnomalyTable anomalies={anomalies.slice(0, 10)} />
        </Card>
      </div>

    </div>
  );
};

export default Dashboard;