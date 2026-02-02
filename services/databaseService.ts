import { QueryResult } from '../types';
import { handleResponse } from './authService';

import { API_BASE_URL as CENTRAL_API_BASE_URL } from '../utils/config';

const API_BASE_URL = `${CENTRAL_API_BASE_URL}/database`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('Authentication token not found.');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const executeQuery = async (sql: string): Promise<QueryResult> => {
    const response = await fetch(`${API_BASE_URL}/execute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sql }),
    });
    return handleResponse(response);
};
