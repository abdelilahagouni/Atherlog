const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';

// Safety check: If it's an absolute URL missing the /api suffix, append it.
// This handles cases where users set VITE_API_URL to just the domain.
export const API_BASE_URL = (rawBaseUrl.startsWith('http') && !rawBaseUrl.endsWith('/api'))
    ? `${rawBaseUrl}/api`
    : rawBaseUrl;

console.log('[Config] API_BASE_URL initialized as:', API_BASE_URL);
