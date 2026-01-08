
import * as React from 'react';
import ReactDOM from 'react-dom';
import Toast from '../components/ui/Toast';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, 5000); // Toasts disappear after 5 seconds
  }, []);

  const toastRoot = document.getElementById('toast-root');

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastRoot && ReactDOM.createPortal(
        <div className="fixed top-5 right-5 z-[100] space-y-3">
          {toasts.map(toast => (
            <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToasts(t => t.filter(t => t.id !== toast.id))}/>
          ))}
        </div>,
        toastRoot
      )}
    </ToastContext.Provider>
  );
};