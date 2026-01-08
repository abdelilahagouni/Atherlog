import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { Icon } from './ui/Icon';

interface ImageHistogramProps {
  imageData: ImageData | null;
  onClose: () => void;
}

const ImageHistogram: React.FC<ImageHistogramProps> = ({ imageData, onClose }) => {
  const { theme } = useTheme();
  const [histogramData, setHistogramData] = React.useState<{ level: number, count: number }[] | null>(null);

  React.useEffect(() => {
    if (!imageData) return;

    const data = new Array(256).fill(0);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      // Calculate luminance (brightness) for the pixel
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      data[luminance]++;
    }

    setHistogramData(data.map((count, level) => ({ level, count })));
  }, [imageData]);

  const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const tooltipBg = theme === 'dark' ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl h-[60vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Icon name="dashboard" className="w-6 h-6" /> Image Brightness Histogram
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 p-4">
          {histogramData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="level" stroke={textColor} tick={{ fill: textColor, fontSize: 10 }} interval={15} />
                <YAxis stroke={textColor} tick={{ fill: textColor, fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                  contentStyle={{ background: tooltipBg, border: 'none', borderRadius: '0.5rem' }}
                  labelStyle={{ color: textColor }}
                />
                <Bar dataKey="count" fill={theme === 'dark' ? '#60a5fa' : '#3b82f6'} barSize={5} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Icon name="loader" className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageHistogram;