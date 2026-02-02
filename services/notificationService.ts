import { LogEntry, NotificationContact } from '../types';
import { handleResponse } from './authService';
import { getNotificationContacts } from './logService';
import { soundNotificationService } from './soundNotificationService';

import { API_BASE_URL } from '../utils/config';

/**
 * Sends a request to the backend to trigger a simulated test notification.
 * @returns A promise that resolves when the request is complete.
 */
export const sendTestNotification = async (): Promise<void> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        throw new Error('Authentication required to send notifications.');
    }
    
    const response = await fetch(`${API_BASE_URL}/notifications/test`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    await handleResponse(response);
};

/**
 * Sends a fatal error log to the backend to trigger real notifications.
 * @param log The fatal log entry.
 */
export const reportFatalError = async (log: LogEntry): Promise<void> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        // Don't throw error, just log it, as this runs in the background
        console.error("Authentication required to report fatal error.");
        return;
    }
    
    // Play WhatsApp-like fatal error sound
    await soundNotificationService.playSound('fatal');
    
     const response = await fetch(`${API_BASE_URL}/notifications/fatal-error`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ logEntry: log }),
    });
    await handleResponse(response);
}


// FIX: Added the missing 'sendFatalErrorNotifications' function to resolve an import error.
/**
 * Simulates sending notifications for a fatal error log.
 * In a real app, this would trigger backend calls to email/SMS services.
 * @param log The fatal log entry.
 * @returns A promise that resolves to an array of notification messages for UI feedback.
 */
export const sendFatalErrorNotifications = async (log: LogEntry): Promise<string[]> => {
    // This is a client-side simulation.
    // It fetches contacts from mock local storage and returns messages.
    try {
        const contacts = await getNotificationContacts();
        const notifications: string[] = [];
        
        if (contacts.length === 0) {
            console.warn("No notification contacts configured for FATAL error alert.", log);
            return []; // Return empty array if no contacts
        }

        // Play WhatsApp-like fatal error sound
        await soundNotificationService.playSound('fatal');

        const shortMessage = log.message.length > 40 ? `${log.message.substring(0, 40)}...` : log.message;

        contacts.forEach(contact => {
            // Simulate sending an SMS to each configured contact
            notifications.push(`[SIMULATED] SMS alert sent to ${contact.name} (${contact.phone}) for: "${shortMessage}"`);
        });

        console.log("Simulated sending fatal error notifications:", notifications);
        return notifications;

    } catch (error) {
        console.error("Failed to simulate sending fatal error notifications:", error);
        return [`Error simulating notifications: ${(error as Error).message}`];
    }
};

/**
 * Triggers sound notification for critical errors
 */
export const playCriticalErrorSound = async (): Promise<void> => {
    await soundNotificationService.playSound('critical');
};

/**
 * Triggers sound notification for warning errors
 */
export const playWarningSound = async (): Promise<void> => {
    await soundNotificationService.playSound('warning');
};

/**
 * Determines error level and plays appropriate sound
 */
export const playErrorSound = async (level: 'FATAL' | 'ERROR' | 'WARN' | 'WARNING'): Promise<void> => {
    switch (level) {
        case 'FATAL':
            await soundNotificationService.playSound('fatal');
            break;
        case 'ERROR':
            await soundNotificationService.playSound('critical');
            break;
        case 'WARN':
        case 'WARNING':
            await soundNotificationService.playSound('warning');
            break;
        default:
            // No sound for info/debug levels
            break;
    }
};