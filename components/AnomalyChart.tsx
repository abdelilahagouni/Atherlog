

import * as React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LogSummary } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface AnomalyChartProps {
  data: LogSummary[];
  onDataClick?: (payload: any) => void;
}

export const AnomalyChart: React.FC<AnomalyChartProps> = ({ data, onDataClick }) => {
  const { theme } = useTheme();

  const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const tooltipBg = theme === 'dark' ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)';
  const tooltipBorder = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const legendColor = theme === 'dark' ? '#d1d5db' : '#374151';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        onClick={onDataClick}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="hour" stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} />
        <YAxis stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} />
        <Tooltip
          cursor={{ stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)', strokeWidth: 1 }}
          contentStyle={{
            background: tooltipBg,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '0.75rem',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          }}
          labelStyle={{ color: legendColor }}
        />
        <Legend wrapperStyle={{ color: legendColor, fontSize: 14 }} />
        <Line type="monotone" dataKey="total" name="Total Logs" stroke="#0ea5e9" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="anomalies" name="Anomalies" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};
