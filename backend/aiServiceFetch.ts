// fetch for calls to the internal AI service (python-service).
// Same as node-fetch, but requests to PYTHON_SERVICE_URL carry the shared secret header X-Internal-Key
// (AI_SERVICE_KEY in backend/.env). The AI service rejects requests from other machines without it.
// The key is added ONLY for the AI service's own address, never for any other host.
import nodeFetch, { RequestInfo, RequestInit } from 'node-fetch';

const aiBase = (): string => {
    let url = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001';
    if (!url.startsWith('http')) url = `http://${url}`;
    return url.replace(/\/$/, '');
};

const aiServiceFetch = (url: RequestInfo, init: RequestInit = {}) => {
    const key = process.env.AI_SERVICE_KEY;
    const target = typeof url === 'string' ? url : (url as any)?.url ?? (url as any)?.href ?? '';
    const base = aiBase();
    if (key && typeof target === 'string' && (target === base || target.startsWith(base + '/'))) {
        const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
        headers['X-Internal-Key'] = key;
        init = { ...init, headers };
    }
    return nodeFetch(url, init);
};

export default aiServiceFetch;
