// POST /api/ingest - public endpoint for external services to send logs (authenticated with X-API-KEY).
//
// Body: one log {level, message, source[, anomalyScore]}  OR  a batch: an array of logs, or {"logs": [...]}.
//  - Batch size: at most INGEST_MAX_BATCH logs per request (default 500).
//  - Rate limits: the request counts once against INGEST_RATE_LIMIT_PER_SECOND (server.ts), and its number of logs
//    counts against INGEST_LOGS_PER_SECOND per API key (default 5000), enforced here.
//  - A batch is scored with ONE call to the AI service (GPU batching); results are returned per log, in order.
//  - Scoring uses the ORIGINAL text (what the model was trained on); only xss-cleaned, privacy-masked text is stored.
//  - If the AI service is unreachable, logs are stored as not scored (null) - never a made-up value.
import express from 'express';
import bcrypt from 'bcryptjs';
import xss from 'xss';
import { getDb } from './database';
import { LogEntry } from './types';
import * as crypto from 'crypto';
import { emitLog } from './websocket';
import fetch from 'node-fetch';
import { cacheVerifiedKey, getCachedKey, hashPresentedKey, invalidateCachedHash } from './apiKeyCache';

const router = express.Router();

const MAX_BATCH = Math.max(1, parseInt(process.env.INGEST_MAX_BATCH || '500', 10) || 500);
const LOGS_PER_SECOND = Math.max(1, parseInt(process.env.INGEST_LOGS_PER_SECOND || '5000', 10) || 5000);

// --------------------------------------------------------------------------- authentication (with cache)
const authenticateApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providedKey = req.header('X-API-KEY');
    if (!providedKey) {
        return res.status(401).json({ message: 'API key is required.' });
    }
    const keyHash = hashPresentedKey(providedKey);          // SHA-256; the raw key is never cached
    (req as any).apiKeyHash = keyHash;
    const db = getDb();

    try {
        // 1. Cached successful verification: skip bcrypt, but confirm the key still exists (cheap primary-key lookup),
        //    so a key revoked by any path is rejected on its very next request.
        const cached = getCachedKey(keyHash);
        if (cached) {
            const still = await db.get<{ organizationId: string }>('SELECT "organizationId" FROM api_keys WHERE "id" = ?', [cached.keyId]);
            if (still && still.organizationId === cached.organizationId) {
                (req as any).organizationId = cached.organizationId;
                return next();
            }
            invalidateCachedHash(keyHash);
            return res.status(401).json({ message: 'Invalid API key.' });
        }

        // 2. Full bcrypt verification (failures are not cached).
        const potentialKeys = await db.all<{ id: string, keyHash: string, organizationId: string }>(
            'SELECT "id", "keyHash", "organizationId" FROM api_keys WHERE "keyPrefix" = ?',
            [providedKey.substring(0, 8)]
        );
        for (const key of potentialKeys) {
            if (await bcrypt.compare(providedKey, key.keyHash)) {
                (req as any).organizationId = key.organizationId;
                cacheVerifiedKey(keyHash, key.id, key.organizationId);
                db.run('UPDATE api_keys SET "lastUsed" = NOW() WHERE "id" = ?', [key.id]).catch(console.error);
                return next();
            }
        }
        console.warn('[Ingest] Rejected: invalid API key');
        return res.status(401).json({ message: 'Invalid API key.' });
    } catch (error) {
        console.error('API key authentication error:', error);
        return res.status(500).json({ message: 'Server error during authentication.' });
    }
};

// --------------------------------------------------------------------------- per-key logs-per-second limit
const logWindows = new Map<string, { start: number, count: number }>();
const takeLogBudget = (keyHash: string, n: number): boolean => {
    const now = Date.now();
    let w = logWindows.get(keyHash);
    if (!w || now - w.start >= 1000) {
        w = { start: now, count: 0 };
        logWindows.set(keyHash, w);
    }
    if (w.count + n > LOGS_PER_SECOND) return false;
    w.count += n;
    return true;
};

// --------------------------------------------------------------------------- scoring (one call per request)
interface Score { score: number | null; category: string; stage: string | null; model: string | null;
                  threshold: number | null; modelHash: string | null; codeHash: string | null;
                  anomaly: boolean | null; }   // anomaly = cascade decision (null: keyword rule / not scored)

const scoreLogs = async (logs: { level: string, message: string, source: string }[]): Promise<Score[]> => {
    const useCascade = process.env.ANOMALY_MODEL === 'cascade';
    const endpoint = useCascade ? '/cascade' : '/urgency';
    const unscored = (): Score => ({ score: null, category: 'Not scored', stage: null, model: null, threshold: null, modelHash: null, codeHash: null, anomaly: null });
    if (logs.length === 0) return [];
    try {
        const url = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), (useCascade ? 10000 : 2000) + 50 * logs.length);
        const r = await fetch(`${url}${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs }),                      // unmasked originals (scoring only, never stored)
            signal: controller.signal as any,
        });
        clearTimeout(timer);
        if (!r.ok) {
            console.error(`[Ingest] AI service ${endpoint} returned ${r.status}; ${logs.length} log(s) stored as not scored.`);
            return logs.map(unscored);
        }
        const out = await r.json() as any[];
        if (!Array.isArray(out) || out.length !== logs.length) {
            console.error(`[Ingest] AI service ${endpoint} returned ${Array.isArray(out) ? out.length : 'no'} results for ${logs.length} logs; stored as not scored.`);
            return logs.map(unscored);
        }
        return out.map((a) => typeof a?.score === 'number'
            ? { score: a.score, category: a.urgency, stage: a.stage ?? null, model: a.model ?? null, threshold: a.threshold ?? null,
                modelHash: a.model_hash ?? null, codeHash: a.code_hash ?? null,
                anomaly: useCascade && typeof a.anomaly === 'boolean' ? a.anomaly : null }
            : unscored());
    } catch (e: any) {
        console.error(`[Ingest] AI service ${endpoint} unreachable (${e.message}); ${logs.length} log(s) stored as not scored.`);
        return logs.map(unscored);
    }
};

// --------------------------------------------------------------------------- route
router.post('/', authenticateApiKey, async (req: express.Request, res: express.Response) => {
    const organizationId = (req as any).organizationId as string;
    const body = req.body;
    const isBatch = Array.isArray(body) || Array.isArray(body?.logs);
    const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.logs) ? body.logs : [body];

    if (items.length === 0) return res.status(400).json({ message: 'No logs in request.' });
    if (items.length > MAX_BATCH) {
        return res.status(413).json({ message: `Batch too large: at most ${MAX_BATCH} logs per request.` });
    }
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || !it.level || !it.message || !it.source) {
            return res.status(400).json({ message: isBatch ? `Log ${i} must include level, message, and source.`
                                                           : 'Log entry must include level, message, and source.' });
        }
    }
    if (!takeLogBudget((req as any).apiKeyHash, items.length)) {
        return res.status(429).json({ message: `Too many logs: limit is ${LOGS_PER_SECOND} logs per second per API key.` });
    }

    const db = getDb();
    const { processLogThroughPipelines, getActivePipelines } = require('./pipelineService');
    try {
        // ORIGINAL text for scoring: exactly what the client sent (the model was trained on raw log text).
        // The global xss sanitizer skips /api/ingest, so nothing has touched these fields yet.
        const scoringLogs = items.map((it) => ({ level: String(it.level), message: String(it.message), source: String(it.source) }));
        // STORED text: xss-cleaned here (same sanitising as every other route) and privacy-masked by the pipeline below.
        const newLogs: Omit<LogEntry, 'id' | 'timestamp'>[] = items.map((it) => ({
            organizationId,
            level: xss(String(it.level)) as any,
            message: xss(String(it.message)),
            source: xss(String(it.source)),
            anomalyScore: typeof it.anomalyScore === 'number' ? it.anomalyScore : null,   // client score kept as is
        }));

        const pipelines = await getActivePipelines(organizationId);                   // once per request
        const processed: (Omit<LogEntry, 'id' | 'timestamp'> | null)[] = [];
        for (const l of newLogs) processed.push(await processLogThroughPipelines(l, organizationId, pipelines));

        const toScore = processed.map((p, i) => (p && p.anomalyScore == null ? i : -1)).filter((i) => i >= 0);
        const scores = await scoreLogs(toScore.map((i) => scoringLogs[i]));
        const scoreOf = new Map<number, Score>(toScore.map((i, k) => [i, scores[k]]));

        const now = new Date().toISOString();
        const rows: any[] = [], results: any[] = [];
        processed.forEach((p, i) => {
            if (!p) { results.push({ index: i, status: 'filtered' }); return; }
            const s: Score = scoreOf.get(i) ?? { score: p.anomalyScore ?? null, category: 'Client-scored', stage: 'client',
                                                  model: null, threshold: null, modelHash: null, codeHash: null, anomaly: null };
            const id = crypto.randomUUID();
            rows.push({ id, p, s });
            results.push({ index: i, status: 'stored', id, anomalyScore: s.score, threatCategory: s.category, scoreStage: s.stage });
        });

        if (rows.length) {
            const cols = '("id", "organizationId", "timestamp", "level", "message", "source", "anomalyScore", "threatCategory", "scoreStage", "scoreModel", "scoreThreshold", "scoreModelHash", "scoreCodeHash")';
            const ph = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const vals = rows.flatMap(({ id, p, s }) => [id, p.organizationId, now, p.level, p.message, p.source, s.score, s.category,
                                                         s.stage, s.model, s.threshold, s.modelHash, s.codeHash]);
            await db.run(`INSERT INTO logs ${cols} VALUES ${ph}`, vals);                 // one statement per request
        }

        const { checkAndAlert } = require('./alertingService');
        for (const { id, p, s } of rows) {
            const entry = { id, organizationId: p.organizationId, timestamp: now, level: p.level, message: p.message,
                            source: p.source, anomalyScore: s.score, threatCategory: s.category, isAnomaly: s.anomaly };
            checkAndAlert(entry).catch((e: any) => console.error('Alerting check failed:', e));
            emitLog(entry as any);
        }

        if (!isBatch) {
            const r = results[0];
            return res.status(202).json(r.status === 'filtered' ? { message: 'Log processed (filtered).' }
                : { message: 'Log received.', id: r.id, anomalyScore: r.anomalyScore, threatCategory: r.threatCategory, scoreStage: r.scoreStage });
        }
        return res.status(202).json({ message: 'Batch received.', received: items.length,
                                      stored: rows.length, filtered: items.length - rows.length, results });
    } catch (error) {
        console.error('Failed to ingest log(s):', error);
        res.status(500).json({ message: 'Failed to ingest log(s).' });
    }
});

export default router;
