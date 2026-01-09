import * as React from 'react';
import { Icon } from './Icon';

interface FloatingActionButtonProps {
  icon: string;
  onClick: () => void;
  label?: string;
  className?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  onClick,
  label,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`fab ${className}`}
      aria-label={label || 'Action button'}
      title={label}
    >
      <Icon name={icon} className="w-6 h-6" />
    </button>
  );
};

export default FloatingActionButton;
