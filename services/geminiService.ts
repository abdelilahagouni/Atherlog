import { LogEntry, GeneratedFilters, ChatMessage, RootCauseAnalysisResponse, FlowchartResponse, DetectedObjectInfo, LogPattern, AiPlaybook, AiDiscovery } from '../types';
import { handleResponse } from './authService';

const API_BASE_URL = '/api/ai';

type ApiStatusValue = 'ok' | 'invalid_key' | 'not_configured' | 'quota_exceeded';

interface ApiStatusResponse {
    geminiConfigured: boolean;
    openaiConfigured: boolean;
    geminiStatus: ApiStatusValue;
    openaiStatus: ApiStatusValue;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('Authentication token not found.');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getApiKeyStatus = async (): Promise<ApiStatusResponse> => {
    const response = await fetch(`${API_BASE_URL}/status`);
    // This is a public endpoint, no auth needed.
    return handleResponse(response);
};

export const explainLogEntry = async (logEntry: LogEntry, provider: 'gemini' | 'openai' | 'python'): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/explain`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logEntry, provider }),
    });
    const data = await handleResponse(response);
    return data.explanation;
};

export const generateFiltersFromQuery = async (query: string, provider: 'gemini' | 'openai' | 'python'): Promise<GeneratedFilters> => {
    const response = await fetch(`${API_BASE_URL}/generate-filters`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query, provider }),
    });
    const data = await handleResponse(response);
    return data.filters;
};

export const sendChatMessage = async (history: ChatMessage[], message: string, provider: 'gemini' | 'openai' | 'python'): Promise<string> => {
     const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ history, message, provider }),
    });
    const data = await handleResponse(response);
    return data.reply;
};

export const extractTextFromImage = async (base64Image: string, mimeType: string, provider: 'gemini' | 'openai' | 'python'): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/extract-text`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ image: base64Image, mimeType, provider }),
    });
    const data = await handleResponse(response);
    return data.text;
};

export const editImageWithAI = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    // This feature uses Gemini exclusively as per component logic.
    const response = await fetch(`${API_BASE_URL}/edit-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ image: base64Image, mimeType, prompt, provider: 'gemini' }),
    });
    const data = await handleResponse(response);
    return data.editedImage;
};

export const generateFlowchartFromText = async (text: string, provider: 'gemini' | 'openai' | 'python'): Promise<FlowchartResponse> => {
    const response = await fetch(`${API_BASE_URL}/generate-flowchart`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text, provider }),
    });
    return handleResponse(response);
};

export const performRootCauseAnalysis = async (targetLog: LogEntry, logHistory: LogEntry[], provider: 'gemini' | 'openai' | 'python'): Promise<RootCauseAnalysisResponse> => {
    const response = await fetch(`${API_BASE_URL}/root-cause-analysis`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetLog, logHistory, provider }),
    });
    return handleResponse(response);
};

export const detectObjectInImage = async (base64Image: string, mimeType: string, provider: 'gemini' | 'openai' | 'python'): Promise<DetectedObjectInfo> => {
     const response = await fetch(`${API_BASE_URL}/detect-object`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ image: base64Image, mimeType, provider }),
    });
    return handleResponse(response);
};

export const executePythonOnText = async (logText: string, script: string, provider: 'gemini' | 'openai' | 'python'): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/execute-python`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logText, script, provider }),
    });
    const data = await handleResponse(response);
    return data.output;
};

export const findLogPatterns = async (logs: LogEntry[], provider: 'gemini' | 'openai' | 'python'): Promise<LogPattern[]> => {
    const response = await fetch(`${API_BASE_URL}/find-patterns`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs, provider }),
    });
    return handleResponse(response);
};

export const generateRemediationPlaybook = async (targetLog: LogEntry, provider: 'gemini' | 'openai' | 'python'): Promise<AiPlaybook> => {
    const response = await fetch(`${API_BASE_URL}/generate-playbook`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetLog, provider }),
    });
    return handleResponse(response);
};

export const discoverInsights = async (logs: LogEntry[]): Promise<AiDiscovery[]> => {
    const response = await fetch(`${API_BASE_URL}/discover-insights`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};

export const trainInternalModel = async (
    logs: LogEntry[], 
    epochs: number = 20, 
    batch_size: number = 16, 
    dropout: number = 0.1, 
    model_type: string = 'tensorflow'
): Promise<{ 
    message: string, 
    samples: number, 
    status: string, 
    metrics?: { train_loss: number, val_loss: number, analysis: string },
    framework: string 
}> => {
    const response = await fetch(`${API_BASE_URL}/train`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs, epochs, batch_size, dropout, model_type }),
    });
    return handleResponse(response);
};

// --- Pro AI Service Functions ---

export const semanticSearch = async (query: string, logs: LogEntry[]): Promise<{ results: { log: LogEntry, score: number }[] }> => {
    const response = await fetch(`${API_BASE_URL}/semantic-search`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query, logs }),
    });
    return handleResponse(response);
};

export const clusterLogs = async (logs: LogEntry[]): Promise<{ clusters: { id: number, count: number, sample: string, logs: LogEntry[] }[] }> => {
    const response = await fetch(`${API_BASE_URL}/cluster`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};

export const classifyUrgency = async (log: LogEntry): Promise<{ urgency: string, score: number }> => {
    const response = await fetch(`${API_BASE_URL}/urgency`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ log }),
    });
    return handleResponse(response);
};

export const forecastVolume = async (history: number[]): Promise<{ forecast: number[], trend: string }> => {
    const response = await fetch(`${API_BASE_URL}/forecast`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ history }),
    });
    return handleResponse(response);
};

export const attributeAnomaly = async (log: LogEntry): Promise<{ primary_cause: string, confidence: number, details: string }> => {
    const response = await fetch(`${API_BASE_URL}/attribute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ log }),
    });
    return handleResponse(response);
};

export const tagLog = async (log: LogEntry): Promise<{ tags: string[] }> => {
    const response = await fetch(`${API_BASE_URL}/tag`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ log }),
    });
    return handleResponse(response);
};

export const getSystemHealth = async (logs: LogEntry[]): Promise<{ score: number, status: string, factors: { name: string, impact: string }[] }> => {
    const response = await fetch(`${API_BASE_URL}/health-score`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};

export const getDependencyMap = async (logs: LogEntry[]): Promise<{ nodes: { id: string, group: number }[], links: { source: string, target: string, value: number }[] }> => {
    const response = await fetch(`${API_BASE_URL}/dependency-map`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};

export const getTimeline = async (logs: LogEntry[]): Promise<{ time: string, count: number, isAnomaly: boolean }[]> => {
    const response = await fetch(`${API_BASE_URL}/timeline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};
