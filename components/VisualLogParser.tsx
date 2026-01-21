
import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { extractTextFromImage, getApiKeyStatus, editImageWithAI } from '../services/geminiService';
import { useToast } from '../hooks/useToast';
import { LogEntry, LogLevel } from '../types';
import ExplainAnomalyModal from './ExplainAnomalyModal';
import ImageEditorModal from './ImageEditorModal';
import FlowchartModal from './FlowchartModal';
import PythonProcessorModal from './PythonProcessorModal';
import ImageHistogram from './ImageHistogram';
import { AiChoiceDropdown } from './ui/AiChoiceDropdown';
import { useAuth } from '../contexts/AuthContext';

type ViewMode = 'color' | 'grayscale' | 'red' | 'green' | 'blue' | 'inverted';
type AiProvider = 'gemini' | 'openai';

const VisualLogParser: React.FC = () => {
    const [imageSrc, setImageSrc] = React.useState<string | null>(null);
    const [originalImageData, setOriginalImageData] = React.useState<ImageData | null>(null);
    const [currentImageData, setCurrentImageData] = React.useState<ImageData | null>(null);
    const [originalImageFile, setOriginalImageFile] = React.useState<File | null>(null);
    const [extractedText, setExtractedText] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingText, setIsLoadingText] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [logToExplain, setLogToExplain] = React.useState<{ log: LogEntry; provider: AiProvider } | null>(null);
    const [isImageEditorOpen, setIsImageEditorOpen] = React.useState(false);
    const [isFlowchartOpen, setIsFlowchartOpen] = React.useState(false);
    const [isPythonModalOpen, setIsPythonModalOpen] = React.useState<{ provider: AiProvider } | null>(null);
    const [isHistogramOpen, setIsHistogramOpen] = React.useState(false);
    const [manualText, setManualText] = React.useState('');
    const [textForFlowchart, setTextForFlowchart] = React.useState<{ text: string; provider: AiProvider } | null>(null);
    const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; }>({ geminiConfigured: false, openaiConfigured: false });
    const [isApiStatusLoading, setIsApiStatusLoading] = React.useState(true);
    // Image processing state
    const [viewMode, setViewMode] = React.useState<ViewMode>('color');
    const [threshold, setThreshold] = React.useState(128);
    const [featureToIsolate, setFeatureToIsolate] = React.useState('eyes');


    const { showToast } = useToast();
    const { currentOrganization } = useAuth();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        getApiKeyStatus().then(setApiStatus).finally(() => setIsApiStatusLoading(false));
    }, []);

    const isAiAvailable = apiStatus.geminiConfigured || apiStatus.openaiConfigured;
    const defaultProvider = apiStatus.openaiConfigured ? 'openai' : 'gemini';

    const textStats = React.useMemo(() => {
        if (!manualText) return { lines: 0, words: 0, chars: 0 };
        const lines = manualText.split('\n').filter(Boolean).length;
        const words = manualText.trim().split(/\s+/).filter(Boolean).length;
        const chars = manualText.length;
        return { lines, words, chars };
    }, [manualText]);
    
    const runTextExtraction = async (base64: string, mimeType: string, provider: AiProvider) => {
        setIsLoadingText(true);
        try {
            const text = await extractTextFromImage(base64, mimeType, provider);
            setExtractedText(text);
            if(!text) {
                showToast('No text could be extracted from the image.', 'info');
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during text extraction.');
            showToast('Failed to extract text from image.', 'error');
        } finally {
            setIsLoadingText(false);
        }
    };

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please upload a valid image file (PNG, JPG, etc.).');
            return;
        }
        
        handleStartOver(); // Reset everything first
        setOriginalImageFile(file);
        setIsLoading(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setImageSrc(result);
            
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setOriginalImageData(imageData);
                setCurrentImageData(imageData);
            };
            img.src = result;
            
            runTextExtraction(result.split(',')[1], file.type, defaultProvider);
            setIsLoading(false);
        };
        reader.onerror = () => {
            setError('Failed to read the file.');
            setIsLoading(false);
        };
        reader.readAsDataURL(file);
    };
    
    // Effect for applying image processing
    React.useEffect(() => {
        if (!originalImageData || !canvasRef.current) return;
    
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
    
        // Thresholding only applies to single-channel views for this simple toolkit
        const isThresholdingActive = ['grayscale', 'red', 'green', 'blue'].includes(viewMode);
    
        const originalData = originalImageData.data;
        const newImageData = ctx.createImageData(canvas.width, canvas.height);
        const newData = newImageData.data;
    
        for (let i = 0; i < originalData.length; i += 4) {
            const r = originalData[i];
            const g = originalData[i + 1];
            const b = originalData[i + 2];
    
            let finalR = r, finalG = g, finalB = b;
            
            if (viewMode === 'inverted') {
                finalR = 255 - r;
                finalG = 255 - g;
                finalB = 255 - b;
            } else if (isThresholdingActive) {
                let grayValue = 0;
                switch (viewMode) {
                    case 'grayscale':
                        grayValue = 0.299 * r + 0.587 * g + 0.114 * b; // Luminance
                        break;
                    case 'red':
                        grayValue = r;
                        break;
                    case 'green':
                        grayValue = g;
                        break;
                    case 'blue':
                        grayValue = b;
                        break;
                }
                const thresholdedValue = grayValue > threshold ? 255 : 0;
                finalR = finalG = finalB = thresholdedValue;
            }
    
            newData[i] = finalR;
            newData[i + 1] = finalG;
            newData[i + 2] = finalB;
            newData[i + 3] = originalData[i + 3]; // Alpha
        }
        ctx.putImageData(newImageData, 0, 0);
        setCurrentImageData(newImageData);
    
    }, [viewMode, threshold, originalImageData]);
    
    const handleReScan = (provider: AiProvider) => {
        if (!canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        runTextExtraction(dataUrl.split(',')[1], 'image/png', provider);
    };

    const handleDownloadImage = () => {
        if (canvasRef.current) {
            const link = document.createElement('a');
            link.download = `aetherlog_${viewMode}_analysis.png`;
            link.href = canvasRef.current.toDataURL('image/png');
            link.click();
        }
    };
    
    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isOver: boolean) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(isOver); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { handleDragEvents(e, false); if (isAiAvailable) e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]); };
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (isAiAvailable) e.target.files?.[0] && handleFile(e.target.files[0]); };
    const handleAnalyze = (provider: AiProvider) => { if (extractedText && currentOrganization) setLogToExplain({ log: { id: crypto.randomUUID(), organizationId: currentOrganization.id, timestamp: new Date().toISOString(), level: LogLevel.INFO, message: extractedText, source: 'visual-parser' }, provider }); };
    
    const handleApplyEditedImage = (editedImageBase64: string) => {
        const byteCharacters = atob(editedImageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/png'});
        const newFile = new File([blob], "edited.png", { type: 'image/png' });
        handleFile(newFile);
    };

    const handleIsolateFeature = async () => {
        if (!canvasRef.current) return;
        setIsLoadingText(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            // Refined prompt for strict background deletion as per professor's request
            const prompt = `Keep ONLY the ${featureToIsolate} visible. Turn everything else (background, face skin, hair, other features) completely black or transparent. I want to isolate the ${featureToIsolate}.`;
            
            const editedBase64 = await editImageWithAI(base64, 'image/png', prompt);
            handleApplyEditedImage(editedBase64);
            showToast(`${featureToIsolate} isolated successfully!`, 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to isolate feature.', 'error');
        } finally {
            setIsLoadingText(false);
        }
    };

    const handleStartOver = () => { setImageSrc(null); setOriginalImageFile(null); setExtractedText(null); setError(null); setIsLoading(false); setOriginalImageData(null); setViewMode('color'); setThreshold(128); };
    const handleGenerateFlowchartFromImage = (provider: AiProvider) => { if (extractedText) { setTextForFlowchart({ text: extractedText, provider }); setIsFlowchartOpen(true); } };
    const handleGenerateFlowchartFromText = (provider: AiProvider) => { if (!manualText.trim()) showToast('Please enter some code or text.', 'error'); else { setTextForFlowchart({ text: manualText, provider }); setIsFlowchartOpen(true); } };

    const aiChoices = [
        { label: 'with OpenAI', provider: 'openai' as AiProvider, action: () => {}, disabled: !apiStatus.openaiConfigured, icon: 'sparkles' },
        { label: 'with Gemini', provider: 'gemini' as AiProvider, action: () => {}, disabled: !apiStatus.geminiConfigured, icon: 'logo' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Visual Log Parser</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Upload a screenshot of a log or terminal output to extract and analyze text using AI.</p>
            </div>
            
            <Card className="min-h-[300px]">
                {!imageSrc && !isLoading && (
                    <div className="relative">
                        {!isAiAvailable && !isApiStatusLoading && (
                            <div className="absolute inset-0 bg-gray-100/80 dark:bg-gray-800/80 z-10 flex flex-col items-center justify-center text-center p-4 rounded-xl backdrop-blur-sm">
                                <Icon name="key" className="w-12 h-12 text-yellow-500 mb-4" />
                                <h4 className="font-bold text-gray-800 dark:text-gray-200">AI Features Disabled</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Image analysis requires an AI API key. Please configure a key in Org Settings.</p>
                            </div>
                        )}
                        <div className={`w-full p-8 border-2 border-dashed rounded-xl transition-colors flex flex-col items-center justify-center text-center ${isAiAvailable ? 'cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 dark:hover:bg-blue-500/10' : ''} ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-300 dark:border-gray-600'}`}
                             onDragOver={(e) => isAiAvailable && handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDragEnter={(e) => isAiAvailable && handleDragEvents(e, true)} onDrop={handleDrop} onClick={() => isAiAvailable && fileInputRef.current?.click()}>
                            <Icon name="upload" className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Drag & Drop an Image</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">or click to select a file</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" accept="image/*" />
                        </div>
                    </div>
                )}
                {isLoading && <div className="flex flex-col items-center justify-center h-48"><Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" /><p className="mt-4">Loading Image...</p></div>}
                {error && <p className="text-red-600 dark:text-red-400 text-center">{error}</p>}
                
                {imageSrc && !isLoading && (
                   <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Image Preview</h3>
                            <canvas ref={canvasRef} className="rounded-lg w-full h-auto max-h-[50vh] object-contain bg-black/5 dark:bg-black/20" />
                        </div>
                        <div>
                             <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Extracted Text</h3>
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300 h-[50vh] overflow-y-auto relative">
                                {isLoadingText && <div className="absolute inset-0 bg-gray-100/80 dark:bg-gray-800/80 flex items-center justify-center z-10"><Icon name="loader" className="w-8 h-8 animate-spin text-blue-500"/></div>}
                                {extractedText ? <pre className="whitespace-pre-wrap break-words">{extractedText}</pre> : <p className="italic">No text found.</p>}
                            </div>
                        </div>
                    </div>
                    
                    {/* Image Processing Toolkit */}
                    <Card className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">MATLAB-Style Image Toolkit</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Step 1: Select View Mode</label>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {(['color', 'grayscale', 'inverted', 'red', 'green', 'blue'] as ViewMode[]).map(mode => (
                                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-semibold rounded-full capitalize transition-colors ${viewMode === mode ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{mode}</button>
                                    ))}
                                </div>
                            </div>
                            <div className={['color', 'inverted'].includes(viewMode) ? 'opacity-50' : ''}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Step 2: Binary Threshold</label>
                                {['color', 'inverted'].includes(viewMode) && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable a grayscale or channel view to use thresholding.</p>}
                                <div className="mt-2">
                                    <label className="block text-xs text-gray-500 dark:text-gray-400">Value: <span className="font-bold text-gray-800 dark:text-gray-200">{threshold}</span></label>
                                    <input 
                                        type="range" 
                                        min="0" max="255" value={threshold} 
                                        onChange={e => setThreshold(Number(e.target.value))} 
                                        className="w-full" 
                                        disabled={['color', 'inverted'].includes(viewMode)} 
                                    />
                                </div>
                            </div>
                            <div className={viewMode !== 'color' ? 'opacity-50' : ''}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Step 3: Feature Isolation (Delete Background)</label>
                                {viewMode !== 'color' && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Switch to Color mode to use AI editing.</p>}
                                <div className="mt-2 flex gap-2">
                                    <select 
                                        value={featureToIsolate} 
                                        onChange={(e) => setFeatureToIsolate(e.target.value)}
                                        className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 flex-1"
                                        disabled={viewMode !== 'color'}
                                    >
                                        <option value="eyes">Eyes</option>
                                        <option value="mouth">Mouth</option>
                                        <option value="ears">Ears</option>
                                        <option value="nose">Nose</option>
                                    </select>
                                    <button 
                                        onClick={handleIsolateFeature} 
                                        disabled={viewMode !== 'color' || isLoadingText || !apiStatus.geminiConfigured}
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                                        title={!apiStatus.geminiConfigured ? "Requires Gemini API Key" : "Isolate Feature"}
                                    >
                                        Run
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-between items-center gap-4 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex gap-2">
                                <button onClick={() => setIsHistogramOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-black/5 hover:bg-black/10 rounded-md font-semibold text-gray-700 dark:text-gray-200"><Icon name="dashboard" className="w-5 h-5"/> Show Histogram</button>
                                <button onClick={handleDownloadImage} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-black/5 hover:bg-black/10 rounded-md font-semibold text-gray-700 dark:text-gray-200"><Icon name="download" className="w-5 h-5"/> Download Result</button>
                            </div>
                            <AiChoiceDropdown 
                                choices={aiChoices.map(c => ({...c, disabled: c.disabled || viewMode === 'color'}))} 
                                isLoading={isLoadingText} 
                                onAction={handleReScan}
                                size="sm"
                            >
                                Apply & Re-scan
                            </AiChoiceDropdown>
                        </div>
                    </Card>

                    <div className="mt-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Analysis:</p>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={() => setIsImageEditorOpen(true)} disabled={!apiStatus.geminiConfigured} title={!apiStatus.geminiConfigured ? 'Requires Gemini API key' : ''} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-black/5 hover:bg-black/10 rounded-md font-semibold disabled:opacity-50"><Icon name="edit-image" className="w-5 h-5" /> Edit with AI</button>
                                <AiChoiceDropdown choices={aiChoices} onAction={handleGenerateFlowchartFromImage} size="sm" isLoading={isFlowchartOpen} >Flowchart</AiChoiceDropdown>
                                <AiChoiceDropdown choices={aiChoices} onAction={(p) => setIsPythonModalOpen({provider: p})} size="sm" isLoading={!!isPythonModalOpen} >Process with Python</AiChoiceDropdown>
                                <AiChoiceDropdown choices={aiChoices} onAction={handleAnalyze} size="sm" isLoading={!!logToExplain} >Explain Anomaly</AiChoiceDropdown>
                            </div>
                        </div>
                        <div className="text-center mt-4">
                            <button onClick={handleStartOver} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Start over with a new image</button>
                        </div>
                    </div>
                   </>
                )}
            </Card>

            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Code & Text Blackboard</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4">Paste any code snippet, log, or plain text into the blackboard below to get basic stats or generate a logic flowchart with AI.</p>
                <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Paste your C code, Python script, or log entry here..." className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm border focus:ring-2 focus:ring-blue-500 resize-y" spellCheck="false" />
                <div className="mt-4 flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4 font-mono"><span>Lines: {textStats.lines}</span><span>Words: {textStats.words}</span><span>Chars: {textStats.chars}</span></div>
                    <AiChoiceDropdown choices={aiChoices} onAction={handleGenerateFlowchartFromText} isLoading={isFlowchartOpen}>
                        Generate Flowchart
                    </AiChoiceDropdown>
                </div>
            </Card>

            {logToExplain && <ExplainAnomalyModal logEntry={logToExplain.log} provider={logToExplain.provider} onClose={() => setLogToExplain(null)} />}
            {isImageEditorOpen && originalImageFile && <ImageEditorModal originalImageFile={originalImageFile} onClose={() => setIsImageEditorOpen(false)} onApply={handleApplyEditedImage} />}
            {isFlowchartOpen && textForFlowchart && <FlowchartModal logText={textForFlowchart.text} provider={textForFlowchart.provider} onClose={() => { setIsFlowchartOpen(false); setTextForFlowchart(null); }} />}
            {isPythonModalOpen && extractedText && <PythonProcessorModal logText={extractedText} provider={isPythonModalOpen.provider} onClose={() => setIsPythonModalOpen(null)} />}
            {isHistogramOpen && <ImageHistogram imageData={currentImageData} onClose={() => setIsHistogramOpen(false)} />}
        </div>
    );
};

export default VisualLogParser;
