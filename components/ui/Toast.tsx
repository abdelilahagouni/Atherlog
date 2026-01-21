
import * as React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setVisible(true); // Trigger animation on mount
  }, []);

  const typeStyles = {
    info: 'border-blue-500',
    error: 'border-red-500',
    success: 'border-green-500',
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // Wait for animation to finish
  }

  return (
    <div
      className={`flex items-center justify-between w-full max-w-sm p-4 text-gray-800 dark:text-gray-200 border-l-4 rounded-lg shadow-lg bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 ${typeStyles[type]} transition-all duration-300 ease-in-out transform ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      role="alert"
    >
      <div className="text-sm font-medium">{message}</div>
      <button
        onClick={handleClose}
        type="button"
        className="ml-4 -mx-1.5 -my-1.5 bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-black/10 dark:hover:bg-white/20"
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          ></path>
        </svg>
      </button>
    </div>
  );
};

export default Toast;