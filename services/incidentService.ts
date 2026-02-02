import { Incident, IncidentStatus, User } from '../types';
import { handleResponse } from './authService';

import { API_BASE_URL } from '../utils/config';

const INCIDENTS_API_BASE_URL = `${API_BASE_URL}/incidents`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('Authentication token not found.');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getIncidents = async (): Promise<Incident[]> => {
    const response = await fetch(INCIDENTS_API_BASE_URL, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const getIncidentById = async (id: string): Promise<Incident> => {
    const response = await fetch(`${INCIDENTS_API_BASE_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const updateIncidentStatus = async (id: string, status: IncidentStatus): Promise<Incident> => {
    const response = await fetch(`${INCIDENTS_API_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
    });
    return handleResponse(response);
};

export const addIncidentNote = async (id: string, note: string, user: User): Promise<Incident> => {
    const response = await fetch(`${INCIDENTS_API_BASE_URL}/${id}/notes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ note, userId: user.id, username: user.username }),
    });
    return handleResponse(response);
};