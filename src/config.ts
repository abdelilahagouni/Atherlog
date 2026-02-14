/**
 * Production Configuration
 * 
 * For Vercel deployment, set these environment variables in Vercel Dashboard:
 * - VITE_WS_URL: Your Railway WebSocket URL (e.g., wss://aetherlog-backend-production.up.railway.app)
 * 
 * DO NOT set VITE_API_URL — the Vercel rewrite in vercel.json proxies /api/* to Railway,
 * which avoids CORS issues entirely. The browser only talks to your Vercel domain.
 */

const isProd = import.meta.env.PROD;

interface Config {
  apiUrl: string;
  wsUrl: string;
  pythonUrl: string;
}

// Development config (local)
const devConfig: Config = {
  apiUrl: '/api',
  wsUrl: `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:4000`,
  pythonUrl: 'http://localhost:5001'
};

// Production config
// HTTP API: Use relative /api path so Vercel rewrites proxy to Railway (no CORS).
// WebSocket: Must connect directly to Railway — Vercel can't proxy WebSocket.
const rawProdApiUrl = import.meta.env.VITE_API_URL || '/api';
// SAFETY: If VITE_API_URL points directly at Railway/Render, override to /api
// so the Vercel rewrite proxy handles it (avoids CORS entirely).
const prodApiUrl = (rawProdApiUrl.startsWith('http') && /\.(railway\.app|onrender\.com|herokuapp\.com)/.test(rawProdApiUrl))
  ? '/api'
  : rawProdApiUrl;
const prodConfig: Config = {
  apiUrl: (prodApiUrl.startsWith('http') && !prodApiUrl.endsWith('/api')) ? `${prodApiUrl}/api` : prodApiUrl,
  wsUrl: import.meta.env.VITE_WS_URL || 'wss://aetherlog-backend-production.up.railway.app',
  pythonUrl: import.meta.env.VITE_PYTHON_URL || '/python'
};

const config: Config = isProd ? prodConfig : devConfig;

export default config;

// Export individual URLs for convenience
export const API_URL = config.apiUrl;
export const WS_URL = config.wsUrl;
export const PYTHON_URL = config.pythonUrl;
