import * as React from 'react';
import { Icon } from './Icon';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [startY, setStartY] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0 || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, MAX_PULL));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setStartY(0);
      }
    } else {
      setPullDistance(0);
      setStartY(0);
    }
  };

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = pullProgress * 360;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <div
        className="pull-to-refresh flex items-center gap-2"
        style={{
          transform: `translateX(-50%) translateY(${pullDistance > 0 || isRefreshing ? '0' : '-100%'})`,
        }}
      >
        <Icon
          name={isRefreshing ? 'loader' : 'refresh'}
          className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
          }}
        />
        <span className="text-sm font-medium">
          {isRefreshing
            ? 'Refreshing...'
            : pullDistance >= PULL_THRESHOLD
            ? 'Release to refresh'
            : 'Pull to refresh'}
        </span>
      </div>

      {children}
    </div>
  );
};

export default PullToRefresh;
