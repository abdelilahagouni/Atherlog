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

export const trainInternalModel = async (logs: LogEntry[]): Promise<{ message: string, samples: number, status: string }> => {
    const response = await fetch(`${API_BASE_URL}/train`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logs }),
    });
    return handleResponse(response);
};
