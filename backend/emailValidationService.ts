
import { isSuppressed } from './bounceService';

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validates an email address before sending.
 * Checks syntax and suppression list status.
 */
export const validateEmailForSending = async (email: string, organizationId: string): Promise<ValidationResult> => {
    // 1. Basic Syntax Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Invalid email format' };
    }

    // 2. Suppression List Check (Sender Reputation Protection)
    const suppressed = await isSuppressed(email, organizationId);
    if (suppressed) {
        return { 
            isValid: false, 
            error: 'Email is suppressed due to previous bounce or complaint.' 
        };
    }

    return { isValid: true };
};
