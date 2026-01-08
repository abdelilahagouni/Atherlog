import { ApiKey } from '../types';
import { handleResponse } from './authService';

const API_BASE_URL = '/api/keys';

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('Authentication token not found.');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getApiKeys = async (): Promise<ApiKey[]> => {
    const response = await fetch(API_BASE_URL, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const createApiKey = async (name: string): Promise<{ rawKey: string }> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
    });
    return handleResponse(response);
};

export const deleteApiKey = async (keyId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${keyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok && response.status !== 204) {
        await handleResponse(response); // Throws an error with the message from the body
    }
};