
import { SubscriptionPlan } from '../types';
import { handleResponse } from './authService';

const API_BASE_URL = '/api/payment';

const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const createCheckoutSession = async (planName: SubscriptionPlan): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/create-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ planName }),
    });
    return handleResponse(response);
};
