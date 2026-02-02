import { SavedSearch } from '../types';
import { handleResponse } from './authService';

import { API_BASE_URL } from '../utils/config';

const SEARCH_API_ENDPOINT = `${API_BASE_URL}/searches`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('Authentication token not found.');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getSavedSearches = async (): Promise<SavedSearch[]> => {
    const response = await fetch(SEARCH_API_ENDPOINT, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const createSavedSearch = async (name: string, query: SavedSearch['query']): Promise<SavedSearch> => {
    const response = await fetch(SEARCH_API_ENDPOINT, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, query }),
    });
    return handleResponse(response);
};

export const deleteSavedSearch = async (searchId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${searchId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok && response.status !== 204) {
        await handleResponse(response);
    }
};