import * as React from 'react';

interface TouchRippleProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const TouchRipple: React.FC<TouchRippleProps> = ({ children, className = '', onClick }) => {
  return (
    <div className={`touch-ripple ${className}`} onClick={onClick}>
      {children}
    </div>
  );
};

export default TouchRipple;
