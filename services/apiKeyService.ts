import { ApiKey } from '../types';
import { handleResponse } from './authService';

import { API_BASE_URL } from '../utils/config';

const API_KEYS_ENDPOINT = `${API_BASE_URL}/keys`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('Authentication token not found.');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getApiKeys = async (): Promise<ApiKey[]> => {
    const response = await fetch(API_KEYS_ENDPOINT, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const createApiKey = async (name: string): Promise<{ rawKey: string }> => {
    const response = await fetch(API_KEYS_ENDPOINT, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
    });
    return handleResponse(response);
};

export const deleteApiKey = async (keyId: string): Promise<void> => {
    const response = await fetch(`${API_KEYS_ENDPOINT}/${keyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok && response.status !== 204) {
        await handleResponse(response); // Throws an error with the message from the body
    }
};