import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './ui/Icon';

interface FaceIdLoginModalProps {
  username: string;
  onClose: () => void;
  onLoginSuccess: () => void;
  autoStart?: boolean;
}

const FACE_ID_AUTOLOGIN_KEY = 'faceIdAutoLogin';
const FACE_ID_SAVED_USERNAME = 'faceIdSavedUsername';

type Status = 'initializing' | 'ready' | 'scanning' | 'success' | 'error';

const FaceIdLoginModal: React.FC<FaceIdLoginModalProps> = ({ username, onClose, onLoginSuccess, autoStart = false }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [status, setStatus] = React.useState<Status>('initializing');
  const [error, setError] = React.useState<string | null>(null);
  const { loginWithFaceId } = useAuth();

  const handleScan = React.useCallback(async () => {
    setStatus('scanning');
    setError(null);

    const loginUsername = autoStart ? (localStorage.getItem(FACE_ID_SAVED_USERNAME) || 'superadmin') : username;

    if (!loginUsername) {
        setError("Please enter your username in the login form before using Face ID.");
        setStatus('error');
        return;
    }

    // Simulate a 2.5 second scan
    setTimeout(async () => {
      try {
        await loginWithFaceId(loginUsername);
        setStatus('success');
        setTimeout(() => onLoginSuccess(), 1000);
      } catch (err) {
        setError("Face not recognized. Please try again or use your password.");
        setStatus('error');
        if (autoStart) {
            localStorage.removeItem(FACE_ID_AUTOLOGIN_KEY);
        }
      }
    }, 2500);
  }, [loginWithFaceId, onLoginSuccess, autoStart, username]);

  React.useEffect(() => {
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
           setError("Camera access is not supported by your browser.");
           setStatus('error');
           return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus('ready');
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Camera access was denied. Please enable camera permissions in your browser settings to use Face ID.");
        setStatus('error');
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  React.useEffect(() => {
    if (status === 'ready') {
        handleScan();
    }
  }, [status, handleScan]);


  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return <p className="text-gray-500 dark:text-gray-400 text-center mb-4 animate-pulse">Initializing camera...</p>;
      case 'ready':
      case 'scanning':
        return <p className="text-blue-600 dark:text-blue-400 text-center mb-4 animate-pulse">{autoStart ? 'Verifying identity...' : 'Scanning...'}</p>;
      case 'success':
        return <p className="text-green-600 dark:text-green-400 text-center mb-4 flex items-center justify-center gap-2"><Icon name="check-circle" className="w-5 h-5"/> Success! Redirecting...</p>;
      case 'error':
        return (
           <div className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-center p-3 rounded-lg mb-4 w-full flex items-start gap-2">
                <Icon name="exclamation-triangle" className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
            </div>
        );
      default:
        return null;
    }
  };

  const statusClasses = {
    initializing: 'border-gray-400/50 animate-pulse',
    ready: 'border-blue-500',
    scanning: 'animate-spin-border',
    success: 'border-green-500',
    error: 'border-red-500',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col relative overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Icon name="face-id" className="w-6 h-6" />
            Face ID Login
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" disabled={status === 'scanning'}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center justify-center">
          <div className={`w-64 h-64 rounded-full overflow-hidden relative bg-gray-100 dark:bg-gray-800 border-4 mb-4 flex items-center justify-center transition-colors duration-300 ${statusClasses[status]}`}>
             {status !== 'scanning' && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] rounded-full" />}
             
             {/* Gradient for scanning needs to be inside to be clipped */}
             {status === 'scanning' && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] rounded-full absolute inset-0 z-0" />}

             {status === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                    <Icon name="check-circle" className="w-24 h-24 text-green-500" />
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                    <Icon name="exclamation-triangle" className="w-24 h-24 text-red-500" />
                </div>
            )}
          </div>
          
          <div className="w-full min-h-[60px] flex items-center justify-center">
             {getStatusMessage()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceIdLoginModal;