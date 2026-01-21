import * as React from 'react';
import { LogEntry } from '../types';
import { getLiveLogs } from '../services/logService';

const POLLING_INTERVAL = 3000; // Poll for new logs every 3 seconds

export const useLogStream = (isActive: boolean): { logs: LogEntry[], isLoading: boolean } => {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const lastTimestampRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }

    const fetchInitialLogs = async () => {
        try {
            // Fetch the last 100 logs initially
            const initialLogs = await getLiveLogs(null, 100);
            setLogs(initialLogs);
            if (initialLogs.length > 0) {
                lastTimestampRef.current = initialLogs[initialLogs.length - 1].timestamp;
            }
        } catch (error) {
            console.error("Failed to fetch initial logs:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchInitialLogs();

    const timer = setInterval(async () => {
        try {
            const newLogs = await getLiveLogs(lastTimestampRef.current);
            if (newLogs.length > 0) {
                setLogs(prevLogs => {
                    const updatedLogs = [...prevLogs, ...newLogs];
                     if (updatedLogs.length > 200) { // Keep a max of 200 logs in memory
                        return updatedLogs.slice(updatedLogs.length - 200);
                    }
                    return updatedLogs;
                });
                lastTimestampRef.current = newLogs[newLogs.length - 1].timestamp;
            }
        } catch (error) {
            console.error("Failed to poll for new logs:", error);
        }
    }, POLLING_INTERVAL);

    return () => clearInterval(timer);
  }, [isActive]);

  return { logs, isLoading };
};
