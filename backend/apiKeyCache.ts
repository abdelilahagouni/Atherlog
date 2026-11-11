// In-memory cache of SUCCESSFUL API-key verifications, so bcrypt runs once per key per TTL instead of on every
// ingest request.
//  - Keyed by SHA-256 of the presented key; the raw key is never stored.
//  - TTL from API_KEY_CACHE_TTL_SECONDS (default 300; 0 disables the cache).
//  - Failed verifications are never cached.
//  - invalidateApiKey(id) removes a key immediately (called on revoke/delete). In addition, every cache hit is
//    re-checked against the database by key id (a cheap primary-key lookup), so a key removed by ANY path
//    (SQL console, organisation deletion, ...) is rejected on its very next request.
import * as crypto from 'crypto';

interface Entry { keyId: string; organizationId: string; expiresAt: number; }

const cache = new Map<string, Entry>();

export const apiKeyCacheTtlMs = (): number => {
    const s = parseInt(process.env.API_KEY_CACHE_TTL_SECONDS ?? '300', 10);
    return Number.isFinite(s) && s > 0 ? s * 1000 : 0;
};

export const hashPresentedKey = (rawKey: string): string => crypto.createHash('sha256').update(rawKey).digest('hex');

export const getCachedKey = (keyHash: string): Entry | null => {
    const e = cache.get(keyHash);
    if (!e) return null;
    if (Date.now() >= e.expiresAt) { cache.delete(keyHash); return null; }
    return e;
};

export const cacheVerifiedKey = (keyHash: string, keyId: string, organizationId: string): void => {
    const ttl = apiKeyCacheTtlMs();
    if (ttl > 0) cache.set(keyHash, { keyId, organizationId, expiresAt: Date.now() + ttl });
};

export const invalidateApiKey = (keyId: string): number => {
    let n = 0;
    for (const [h, e] of cache) if (e.keyId === keyId) { cache.delete(h); n++; }
    return n;
};

export const invalidateCachedHash = (keyHash: string): void => { cache.delete(keyHash); };

export const apiKeyCacheSize = (): number => cache.size;
