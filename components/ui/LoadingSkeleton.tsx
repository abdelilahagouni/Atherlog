import * as React from 'react';

interface LoadingSkeletonProps {
  variant?: 'card' | 'text' | 'circle' | 'rectangle';
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'rectangle',
  width = '100%',
  height = '20px',
  count = 1,
  className = '',
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'card':
        return 'h-32 rounded-lg';
      case 'text':
        return 'h-4 rounded';
      case 'circle':
        return 'rounded-full';
      case 'rectangle':
      default:
        return 'rounded';
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`skeleton ${getVariantClasses()} ${className}`}
          style={{ width, height: variant === 'card' ? undefined : height }}
        />
      ))}
    </>
  );
};

export default LoadingSkeleton;
