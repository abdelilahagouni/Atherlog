import * as React from 'react';
import { Icon } from './ui/Icon';
import { editImageWithAI } from '../services/geminiService';
import { useToast } from '../hooks/useToast';

interface ImageEditorModalProps {
  originalImageFile: File;
  onClose: () => void;
  onApply: (editedImageBase64: string) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ originalImageFile, onClose, onApply }) => {
    const [prompt, setPrompt] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [editedImageSrc, setEditedImageSrc] = React.useState<string | null>(null);
    const [originalImageSrc, setOriginalImageSrc] = React.useState<string>('');

    const { showToast } = useToast();

    React.useEffect(() => {
        const reader = new FileReader();
        reader.readAsDataURL(originalImageFile);
        reader.onload = () => setOriginalImageSrc(reader.result as string);
    }, [originalImageFile]);

    const handleGenerate = async () => {
        if (!prompt) {
            showToast('Please enter an editing instruction.', 'error');
            return;
        }
        setIsLoading(true);
        setError(null);
        setEditedImageSrc(null);
        try {
            const base64 = await fileToBase64(originalImageFile);
            const editedBase64 = await editImageWithAI(base64, originalImageFile.type, prompt);
            setEditedImageSrc(`data:image/png;base64,${editedBase64}`);
        } catch (err: any) {
            setError(err.message || 'Failed to edit image.');
            showToast(err.message || 'Failed to edit image.', 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleApply = () => {
        if (editedImageSrc) {
            onApply(editedImageSrc.split(',')[1]);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="edit-image" className="w-6 h-6" /> AI Image Editor
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-4">
                        <label htmlFor="edit-prompt" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Editing Instruction</label>
                        <div className="flex gap-2">
                             <input
                                id="edit-prompt"
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., blur all IP addresses, increase contrast..."
                                className="flex-1 w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                            />
                            <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {isLoading && <Icon name="loader" className="w-5 h-5 animate-spin" />}
                                Generate
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div>
                            <h3 className="text-center text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Original</h3>
                            <div className="aspect-video bg-black/5 dark:bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
                                {originalImageSrc && <img src={originalImageSrc} className="max-w-full max-h-full object-contain" alt="Original" />}
                            </div>
                        </div>
                         <div>
                            <h3 className="text-center text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Edited</h3>
                             <div className="aspect-video bg-black/5 dark:bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
                                {isLoading && <Icon name="loader" className="w-8 h-8 animate-spin text-blue-500" />}
                                {!isLoading && editedImageSrc && <img src={editedImageSrc} className="max-w-full max-h-full object-contain" alt="Edited" />}
                                {!isLoading && !editedImageSrc && <p className="text-gray-500 dark:text-gray-400 text-sm">A new version will appear here</p>}
                            </div>
                        </div>
                    </div>
                     {error && <p className="text-red-500 dark:text-red-300 text-center mt-4">{error}</p>}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-end gap-4 mt-auto">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={handleApply} disabled={!editedImageSrc || isLoading} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Apply Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageEditorModal;