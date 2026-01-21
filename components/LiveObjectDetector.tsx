import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { detectObjectInImage, getApiKeyStatus } from '../services/geminiService';
import { useToast } from '../hooks/useToast';
import { DetectedObjectInfo } from '../types';

type AiProvider = 'gemini' | 'openai';

const LiveObjectDetector: React.FC = () => {
    const [isDetecting, setIsDetecting] = React.useState(false);
    const [status, setStatus] = React.useState<'idle' | 'initializing' | 'detecting' | 'error'>('initializing');
    const [detectedObject, setDetectedObject] = React.useState<DetectedObjectInfo | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [provider, setProvider] = React.useState<AiProvider>('openai');
    const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; }>({ geminiConfigured: false, openaiConfigured: false });

    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const detectionIntervalRef = React.useRef<number | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const { showToast } = useToast();
    
    React.useEffect(() => {
        getApiKeyStatus().then(status => {
            setApiStatus(status)
            if (status.openaiConfigured) {
                setProvider('openai');
            } else if (status.geminiConfigured) {
                setProvider('gemini');
            }
        });
    }, []);

    // Initialize Camera
    React.useEffect(() => {
        const startCamera = async () => {
          try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
               setError("Camera access is not supported by your browser.");
               setStatus('error');
               return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
            setStatus('idle');
          } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Camera access was denied. Please enable camera permissions in your browser settings.");
            setStatus('error');
          }
        };
    
        startCamera();
    
        return () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
          }
        };
    }, []);

    // Detection Loop
    React.useEffect(() => {
        const captureAndDetect = async () => {
            if (!videoRef.current || !canvasRef.current || !isDetecting) return;
            
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (!context) return;
            
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64 = dataUrl.split(',')[1];
            
            try {
                const objectInfo = await detectObjectInImage(base64, 'image/jpeg', provider);
                // Only update if confidence is high enough to avoid flickering
                if (objectInfo && objectInfo.confidence >= 70) {
                    setDetectedObject(objectInfo);
                }
            } catch (err: any) {
                showToast(err.message, 'error');
                setIsDetecting(false); // Stop on error
            }
        };

        if (isDetecting) {
            setStatus('detecting');
            detectionIntervalRef.current = window.setInterval(captureAndDetect, 2000); // 1 frame every 2 seconds
        } else {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            if (status === 'detecting') setStatus('idle');
        }

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, [isDetecting, showToast, status, provider]);

    const toggleDetection = () => {
        if (status !== 'error') {
            setIsDetecting(prev => !prev);
            if(isDetecting) { // If it was detecting, clear the object
                setDetectedObject(null);
            }
        }
    };

    const getStatusOverlay = () => {
        if (status === 'initializing') {
            return <p className="text-gray-600 dark:text-gray-300 animate-pulse">Initializing camera...</p>;
        }
        if (status === 'error') {
            return (
                <div className="text-center text-red-600 dark:text-red-400">
                    <Icon name="exclamation-triangle" className="w-12 h-12 mx-auto mb-2" />
                    <p>{error}</p>
                </div>
            );
        }
        if (status === 'detecting') {
             return (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500/80 text-white rounded-full animate-pulse">
                    <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                    <span>DETECTING (with {provider})</span>
                </div>
            );
        }
        return null;
    };
    
    const isAnyProviderAvailable = apiStatus.geminiConfigured || apiStatus.openaiConfigured;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Live Object Detector</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Point your camera at an object to identify it using real-time AI analysis.</p>
            </div>
            
            <Card>
                <div className="w-full aspect-video bg-black/5 dark:bg-black/20 rounded-lg overflow-hidden relative flex items-center justify-center">
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`w-full h-full object-cover transition-opacity duration-300 ${status === 'error' ? 'opacity-0' : 'opacity-100'}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {getStatusOverlay()}
                    </div>
                    
                    {detectedObject && isDetecting && (
                        <div
                            key={detectedObject.name + detectedObject.confidence}
                            className="absolute bottom-5 left-5 right-5 p-4 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center gap-4 animate-slide-up-fade-in"
                        >
                            <div className="text-5xl">{detectedObject.emoji}</div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 capitalize truncate">{detectedObject.name}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{detectedObject.description}</p>
                            </div>
                            <div className="relative w-16 h-16 flex-shrink-0">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                    <path className="text-black/10 dark:text-white/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                    <path className="text-green-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${detectedObject.confidence}, 100`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease-in-out' }}></path>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{Math.round(detectedObject.confidence)}<span className="text-sm">%</span></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                 <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as AiProvider)}
                        disabled={isDetecting || !isAnyProviderAvailable}
                        className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                    >
                        <option value="openai" disabled={!apiStatus.openaiConfigured}>Use OpenAI</option>
                        <option value="gemini" disabled={!apiStatus.geminiConfigured}>Use Gemini</option>
                    </select>
                    <button
                        onClick={toggleDetection}
                        disabled={status === 'initializing' || status === 'error' || !isAnyProviderAvailable}
                        title={!isAnyProviderAvailable ? 'No AI provider is configured' : ''}
                        className={`px-6 py-3 rounded-lg text-lg font-semibold flex items-center gap-3 transition-colors text-white ${
                            isDetecting 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                    >
                        <Icon name={isDetecting ? 'pause' : 'play'} className="w-6 h-6" />
                        {isDetecting ? 'Stop Detection' : 'Start Detection'}
                    </button>
                 </div>
            </Card>
            <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
    );
};

export default LiveObjectDetector;
