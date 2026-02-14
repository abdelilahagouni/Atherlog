import { SubscriptionPlan } from '../types';
import { handleResponse } from './authService';

import { API_BASE_URL as BASE_API_URL } from '../utils/config';

const API_BASE_URL = `${BASE_API_URL}/payment`;

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

export interface CheckoutResult {
    mode: 'stripe' | 'simulated';
    message: string;
    sessionId?: string;
    url?: string;
}

export const createCheckoutSession = async (planName: SubscriptionPlan): Promise<CheckoutResult> => {
    const response = await fetch(`${API_BASE_URL}/create-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ planName }),
    });
    return handleResponse(response);
};

export const getPaymentStatus = async (): Promise<{ stripe_configured: boolean; mode: string; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/status`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};
