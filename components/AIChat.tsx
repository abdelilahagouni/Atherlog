import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage } from '../types';
import { sendChatMessage, getApiKeyStatus } from '../services/geminiService';
import { useToast } from '../hooks/useToast';

type AiProvider = 'gemini' | 'openai' | 'python';

const CodeBlock: React.FC<{ content: string }> = ({ content }) => {
    const { showToast } = useToast();
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        showToast('Code copied to clipboard!', 'success');
    };

    return (
        <div className="bg-gray-800 dark:bg-black/50 rounded-lg my-2 relative">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-gray-300 hover:text-white transition-colors"
                title="Copy code"
            >
                <Icon name="copy" className="w-4 h-4" />
            </button>
            <pre className="p-4 text-sm text-white overflow-x-auto">
                <code>{content}</code>
            </pre>
        </div>
    );
};

const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return (
        <div>
            {parts.map((part, index) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const code = part.slice(3, -3).trim();
                    return <CodeBlock key={index} content={code} />;
                }
                // Basic markdown for bold text **text**
                const boldedParts = part.split(/(\*\*.*?\*\*)/g).map((subPart, subIndex) => {
                    if (subPart.startsWith('**') && subPart.endsWith('**')) {
                        return <strong key={subIndex}>{subPart.slice(2, -2)}</strong>;
                    }
                    return subPart;
                });
                return <p key={index} className="whitespace-pre-wrap">{boldedParts}</p>;
            })}
        </div>
    );
};


const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    
    return (
        <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <Icon name="brain" className="w-8 h-8 flex-shrink-0 text-blue-500 bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-full" />}
            <div className={`max-w-xl p-3 rounded-2xl ${isUser ? 'bg-blue-500 text-white rounded-br-lg' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-lg'}`}>
                <FormattedMessage text={message.parts[0].text} />
            </div>
             {isUser && <Icon name="user-circle" className="w-8 h-8 flex-shrink-0 text-gray-500" />}
        </div>
    );
};


const AIChat: React.FC = () => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [provider, setProvider] = React.useState<AiProvider>('openai');
    const [apiStatus, setApiStatus] = React.useState<{ geminiConfigured: boolean; openaiConfigured: boolean; }>({ geminiConfigured: false, openaiConfigured: false });
    const chatContainerRef = React.useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [isProcessingInitial, setIsProcessingInitial] = React.useState(true);


    React.useEffect(() => {
        getApiKeyStatus().then(status => {
            setApiStatus(status);
            // Set default provider based on availability
            if (status.openaiConfigured) {
                setProvider('openai');
            } else if (status.geminiConfigured) {
                setProvider('gemini');
            } else {
                setProvider('python');
            }
        });
    }, []);

    const resetChat = React.useCallback((prov: AiProvider) => {
        setMessages([
            {
                role: 'model',
                parts: [{ text: `Hello ${currentUser?.username}! I'm the AetherLog assistant, powered by ${prov}. How can I help?` }]
            }
        ]);
    }, [currentUser?.username]);
    
    // Effect to handle one-time initial message from navigation
    React.useEffect(() => {
        const { initialMessage, provider: stateProvider } = location.state || {};
        if (initialMessage) {
            navigate(location.pathname, { replace: true, state: {} }); // Clear state

            const effectiveProvider = stateProvider || provider;
            setProvider(effectiveProvider);

            const userMessage: ChatMessage = { role: 'user', parts: [{ text: initialMessage }] };
            const welcomeMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: `Hello ${currentUser?.username}! I'm the AetherLog assistant, powered by ${effectiveProvider}. How can I help?` }]
            };
            
            const newMessages = [welcomeMessage, userMessage];
            setMessages(newMessages);
            setIsLoading(true);

            const sendMessage = async () => {
                try {
                    const history = [welcomeMessage];
                    const replyText = await sendChatMessage(history, initialMessage, effectiveProvider);
                    setMessages(prev => [...prev, { role: 'model', parts: [{ text: replyText }] }]);
                } catch (error: any) {
                    showToast(error.message || 'Failed to get a response from the AI.', 'error');
                    setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Sorry, I encountered an error.' }] }]);
                } finally {
                    setIsLoading(false);
                }
            };
            sendMessage();
        } else {
            setIsProcessingInitial(false); // No initial message to process
        }
    }, [location.state, navigate, location.pathname, provider, currentUser?.username, showToast]);

    // This effect handles user-initiated provider changes
    React.useEffect(() => {
        if (!isProcessingInitial) {
            resetChat(provider);
        }
    }, [provider, isProcessingInitial, resetChat]);


     React.useEffect(() => {
        chatContainerRef.current?.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }, [messages, isLoading]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: input.trim() }] };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const history = newMessages.slice(0, -1);
            const replyText = await sendChatMessage(history, userMessage.parts[0].text, provider);
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: replyText }] };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error: any) {
            showToast(error.message || 'Failed to get a response from the AI.', 'error');
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: 'Sorry, I encountered an error. Please try again.' }] };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const isAnyProviderAvailable = apiStatus.geminiConfigured || apiStatus.openaiConfigured;

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">AI Chat</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Have a conversation with the AI about your logs, system health, or general queries.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="provider-select" className="text-sm font-medium text-gray-600 dark:text-gray-300">Provider:</label>
                    <select
                        id="provider-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as AiProvider)}
                        className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                    >
                        <option value="openai" disabled={!apiStatus.openaiConfigured}>OpenAI</option>
                        <option value="gemini" disabled={!apiStatus.geminiConfigured}>Gemini</option>
                        <option value="python">Python AI (Internal)</option>
                    </select>
                </div>
            </div>
            
            <div ref={chatContainerRef} className="flex-1 my-6 space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                {messages.map((msg, index) => (
                    <MessageBubble key={index} message={msg} />
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3 justify-start">
                        <Icon name="brain" className="w-8 h-8 flex-shrink-0 text-blue-500 bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-full" />
                        <div className="max-w-xl p-3 rounded-2xl bg-gray-200 dark:bg-gray-700 rounded-bl-lg flex items-center gap-2">
                           <div className="w-2 h-2 bg-gray-500 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
                           <div className="w-2 h-2 bg-gray-500 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                           <div className="w-2 h-2 bg-gray-500 rounded-full animate-[bounce_1s_infinite_300ms]"></div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                 <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask the AI anything..."
                        rows={1}
                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg p-3 pr-16 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 resize-none disabled:opacity-50"
                    />
                    <button 
                        onClick={handleSendMessage} 
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                        aria-label="Send message"
                    >
                        <Icon name="paper-plane" className="w-5 h-5" />
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default AIChat;