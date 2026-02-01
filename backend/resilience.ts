import fetch from 'node-fetch';

type RetryOptions = {
    attempts?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    timeoutMs?: number;
    breakerKey?: string;
};

type BreakerState = {
    failures: number;
    openUntil: number;
};

const breakers = new Map<string, BreakerState>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const withTimeout = async <T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    if (!timeoutMs || timeoutMs <= 0) return p;
    let timeout: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        return await Promise.race([p, timeoutPromise]);
    } finally {
        clearTimeout(timeout);
    }
};

const isBreakerOpen = (key: string) => {
    const st = breakers.get(key);
    if (!st) return false;
    if (st.openUntil <= Date.now()) {
        breakers.delete(key);
        return false;
    }
    return true;
};

const recordSuccess = (key: string) => {
    if (!key) return;
    breakers.delete(key);
};

const recordFailure = (key: string, maxFailures: number, openMs: number) => {
    if (!key) return;
    const current = breakers.get(key) || { failures: 0, openUntil: 0 };
    current.failures += 1;
    if (current.failures >= maxFailures) {
        current.openUntil = Date.now() + openMs;
    }
    breakers.set(key, current);
};

export const retry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
    const attempts = Math.max(1, options.attempts ?? 3);
    const initialDelayMs = Math.max(0, options.initialDelayMs ?? 250);
    const backoffFactor = Math.max(1, options.backoffFactor ?? 2);
    const timeoutMs = Math.max(0, options.timeoutMs ?? 0);
    const breakerKey = options.breakerKey || '';

    const maxFailures = 3;
    const openMs = 60_000;

    if (breakerKey && isBreakerOpen(breakerKey)) {
        throw new Error(`Circuit breaker open for ${breakerKey}`);
    }

    let lastErr: any;
    let delay = initialDelayMs;

    for (let i = 0; i < attempts; i++) {
        try {
            const res = await withTimeout(fn(), timeoutMs, breakerKey || 'operation');
            if (breakerKey) recordSuccess(breakerKey);
            return res;
        } catch (e: any) {
            lastErr = e;
            if (breakerKey) recordFailure(breakerKey, maxFailures, openMs);
            if (i === attempts - 1) break;
            await sleep(delay);
            delay = Math.min(Math.floor(delay * backoffFactor), 10_000);
        }
    }

    throw lastErr;
};

export const fetchJsonWithRetry = async <T>(url: string, body: any, options: RetryOptions = {}): Promise<T> => {
    return retry(async () => {
        const controller = new AbortController();
        const timeoutMs = Math.max(0, options.timeoutMs ?? 8000);
        const t = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body ?? {}),
                signal: controller.signal as any,
            } as any);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return (await resp.json()) as T;
        } finally {
            if (t) clearTimeout(t);
        }
    }, options);
};
