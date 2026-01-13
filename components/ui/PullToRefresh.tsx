import React, { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const THRESHOLD = 80;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - startY;

      if (window.scrollY === 0 && deltaY > 0) {
        // Prevent default only if we are pulling down at the top
        if (deltaY < THRESHOLD * 2) { // Limit the pull distance
             setCurrentY(deltaY);
             // e.preventDefault(); // Optional: might interfere with scrolling if not careful
        }
      }
    };

    const handleTouchEnd = async () => {
      if (currentY > THRESHOLD) {
        setRefreshing(true);
        setCurrentY(THRESHOLD); // Snap to threshold
        await onRefresh();
        setRefreshing(false);
        setCurrentY(0);
      } else {
        setCurrentY(0);
      }
      setStartY(0);
    };

    const element = contentRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [startY, currentY, onRefresh]);

  return (
    <div ref={contentRef} style={{ touchAction: 'pan-y' }}>
      <div
        className="fixed top-0 left-0 w-full flex justify-center items-center pointer-events-none transition-transform duration-200 ease-out z-50"
        style={{
          transform: `translateY(${currentY > 0 ? currentY - 40 : -40}px)`,
          opacity: currentY > 0 ? currentY / THRESHOLD : 0,
        }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg border border-gray-200 dark:border-gray-700">
          {refreshing ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          ) : (
            <svg
              className={`w-6 h-6 text-gray-500 transform transition-transform duration-200 ${
                currentY > THRESHOLD ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${currentY > 0 ? currentY / 3 : 0}px)`,
          transition: refreshing ? 'transform 0.2s' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
