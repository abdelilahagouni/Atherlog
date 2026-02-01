/**
 * Production Configuration
 * 
 * For Vercel deployment, set these environment variables:
 * - VITE_API_URL: Your Railway backend URL
 * - VITE_WS_URL: Your Railway WebSocket URL (same as API but wss://)
 * - VITE_PYTHON_URL: Your Python service URL (optional)
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

// Production config (from environment variables or defaults)
const prodConfig: Config = {
  apiUrl: import.meta.env.VITE_API_URL || 'https://aetherlog-backend.up.railway.app',
  wsUrl: import.meta.env.VITE_WS_URL || 'wss://aetherlog-backend.up.railway.app',
  pythonUrl: import.meta.env.VITE_PYTHON_URL || 'https://aetherlog-python.up.railway.app'
};

const config: Config = isProd ? prodConfig : devConfig;

export default config;

// Export individual URLs for convenience
export const API_URL = config.apiUrl;
export const WS_URL = config.wsUrl;
export const PYTHON_URL = config.pythonUrl;
