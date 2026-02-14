/**
 * API Configuration
 *
 * In production (Vercel), DO NOT set VITE_API_URL.
 * The Vercel rewrite in vercel.json proxies /api/* to Railway,
 * so the browser only talks to the Vercel domain — no CORS issues.
 *
 * Setting VITE_API_URL to the Railway URL causes direct cross-origin
 * requests that fail with CORS errors.
 */
const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';

// SAFETY: If someone accidentally sets VITE_API_URL to a Railway/remote URL
// in production, override it to '/api' so the Vercel proxy is used instead.
const isProd = import.meta.env.PROD;
const looksLikeDirectBackend = rawBaseUrl.startsWith('http') && (
    rawBaseUrl.includes('.railway.app') ||
    rawBaseUrl.includes('.onrender.com') ||
    rawBaseUrl.includes('.herokuapp.com')
);

let resolvedUrl: string;
if (isProd && looksLikeDirectBackend) {
    console.warn(
        '[Config] VITE_API_URL points directly to backend (%s). ' +
        'Overriding to "/api" to use Vercel proxy and avoid CORS issues.',
        rawBaseUrl
    );
    resolvedUrl = '/api';
} else if (rawBaseUrl.startsWith('http') && !rawBaseUrl.endsWith('/api')) {
    // Append /api if it's an absolute URL missing the suffix
    resolvedUrl = `${rawBaseUrl}/api`;
} else {
    resolvedUrl = rawBaseUrl;
}

export const API_BASE_URL = resolvedUrl;

console.log('[Config] API_BASE_URL:', API_BASE_URL);
