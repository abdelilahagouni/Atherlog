// Proactive AI Insights computed ONLY from the internal BGL cascade's stored decisions.
// No external AI service (no Gemini / OpenAI) is called, and nothing is generated or guessed:
// every number in an insight is counted from the logs table.
//
// A log is an anomaly when the cascade forwarded it to DistilBERT and DistilBERT's score was >= 0.5
// (scoreStage = 'stage2_distilbert' AND anomalyScore >= 0.5) - the same rule as python-service/cascade.py.
import { getDb } from './database';

export type InsightType = 'TREND' | 'NEW_ERROR' | 'SPIKE' | 'ANOMALY_CLUSTER';
export interface Insight {
    id: string;
    type: InsightType;
    title: string;
    summary: string;
    implication: string;
    investigationFilters: { keyword?: string; source?: string; level?: string };
}
export interface InsightsResult {
    insights: Insight[];
    basis: {
        model: string | null;          // cascade model name stored with the logs
        windowHours: number;           // "recent" window
        baselineDays: number;          // comparison window before it
        scoredRecent: number;          // logs scored by the cascade in the recent window
        anomaliesRecent: number;       // of which the cascade flagged as anomaly
        scoredBaseline: number;
        anomaliesBaseline: number;
        notScoredRecent: number;       // logs in the recent window without a cascade decision (demo, keyword rule, AI down)
        generatedAt: string;
    };
}

const RECENT_HOURS = 24;
const BASELINE_DAYS = 7;
const MAX_INSIGHTS = 5;
const IS_SCORED = `"scoreStage" IN ('stage1_lr', 'stage2_distilbert')`;
const IS_ANOMALY = `"scoreStage" = 'stage2_distilbert' AND "anomalyScore" >= 0.5`;

/** Message -> pattern: numbers and hex values become placeholders, so repeats of one event group together. */
export const toPattern = (m: string): string =>
    String(m)
        .replace(/0x[0-9a-f]+/gi, '<HEX>')
        .replace(/\b\d+(?:[.:]\d+)*\b/g, '<N>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);

/** The most distinctive word of a pattern, for the Log Explorer keyword filter. */
const keywordOf = (pattern: string): string | undefined => {
    const words = pattern.split(/[^A-Za-z_]+/).filter((w) => w.length >= 4 && !/^(HEX|the|and|with|from|this|that)$/i.test(w));
    return words.sort((a, b) => b.length - a.length)[0];
};

const shortId = (s: string): string => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
};
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const single = <T,>(xs: T[]): T | undefined => (new Set(xs).size === 1 ? xs[0] : undefined);

interface Row { timestamp: string; level: string; source: string; message: string; anomalyScore: number }

export const computeInsights = async (organizationId: string): Promise<InsightsResult> => {
    const db = getDb();
    const now = Date.now();
    const recentStart = new Date(now - RECENT_HOURS * 3600e3).toISOString();
    const hourStart = new Date(now - 3600e3).toISOString();
    const baseStart = new Date(now - RECENT_HOURS * 3600e3 - BASELINE_DAYS * 86400e3).toISOString();

    // Per-source counts (scored / anomalies) in the recent and baseline windows.
    const counts = await db.all<{ source: string; win: string; scored: number; anomalies: number }>(
        `SELECT source, CASE WHEN "timestamp" >= ? THEN 'recent' ELSE 'base' END AS win,
                COUNT(*) FILTER (WHERE ${IS_SCORED})::int AS scored,
                COUNT(*) FILTER (WHERE ${IS_ANOMALY})::int AS anomalies
           FROM logs WHERE "organizationId" = ? AND "timestamp" >= ?
          GROUP BY 1, 2`,
        [recentStart, organizationId, baseStart]
    );
    const notScored = await db.get<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM logs WHERE "organizationId" = ? AND "timestamp" >= ? AND NOT (${IS_SCORED})`,
        [organizationId, recentStart]
    );
    const modelRow = await db.get<{ m: string }>(
        `SELECT "scoreModel" AS m FROM logs WHERE "organizationId" = ? AND ${IS_SCORED} AND "scoreModel" IS NOT NULL
          ORDER BY "timestamp" DESC LIMIT 1`,
        [organizationId]
    );
    // The anomalies themselves (recent + baseline), newest first.
    const anomalies = await db.all<Row>(
        `SELECT "timestamp", level, source, message, "anomalyScore"
           FROM logs WHERE "organizationId" = ? AND "timestamp" >= ? AND ${IS_ANOMALY}
          ORDER BY "timestamp" DESC LIMIT 20000`,
        [organizationId, baseStart]
    );

    const sum = (win: string, k: 'scored' | 'anomalies') => counts.filter((c) => c.win === win).reduce((a, c) => a + Number(c[k]), 0);
    const basis: InsightsResult['basis'] = {
        model: modelRow?.m ?? null,
        windowHours: RECENT_HOURS,
        baselineDays: BASELINE_DAYS,
        scoredRecent: sum('recent', 'scored'),
        anomaliesRecent: sum('recent', 'anomalies'),
        scoredBaseline: sum('base', 'scored'),
        anomaliesBaseline: sum('base', 'anomalies'),
        notScoredRecent: notScored?.n ?? 0,
        generatedAt: new Date(now).toISOString(),
    };

    const recent = anomalies.filter((a) => new Date(a.timestamp).toISOString() >= recentStart);
    const baseline = anomalies.filter((a) => new Date(a.timestamp).toISOString() < recentStart);
    const groups = new Map<string, Row[]>();
    for (const a of recent) {
        const p = toPattern(a.message);
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p)!.push(a);
    }
    const baselinePatterns = new Set(baseline.map((a) => toPattern(a.message)));
    const used = new Set<string>();
    const out: Insight[] = [];
    const describe = (rows: Row[]) => {
        const srcs = [...new Set(rows.map((r) => r.source))];
        const mean = rows.reduce((a, r) => a + Number(r.anomalyScore), 0) / rows.length;
        return { srcs, mean, level: single(rows.map((r) => r.level)), source: single(rows.map((r) => r.source)) };
    };

    // 1) SPIKE: anomalies in the last hour vs the hourly average of the previous 23 hours, per source.
    const bySource = new Map<string, Row[]>();
    for (const a of recent) { if (!bySource.has(a.source)) bySource.set(a.source, []); bySource.get(a.source)!.push(a); }
    for (const [source, rows] of bySource) {
        const lastHour = rows.filter((r) => new Date(r.timestamp).toISOString() >= hourStart).length;
        const before = (rows.length - lastHour) / (RECENT_HOURS - 1);
        if (lastHour >= 3 && lastHour >= 3 * before) {
            out.push({
                id: `spike-${shortId(source)}`, type: 'SPIKE',
                title: `Anomaly spike in ${source}`,
                summary: `The BGL cascade flagged ${lastHour} anomalies from ${source} in the last hour, against an average of ${before.toFixed(1)} per hour over the previous ${RECENT_HOURS - 1} hours.`,
                implication: 'A sudden rise in anomalies from one source often means a fault is developing there right now.',
                investigationFilters: { source },
            });
        }
    }

    // 2) NEW_ERROR: anomaly patterns seen in the last 24 h but never flagged in the baseline window.
    //    Only reported when there IS a baseline to compare with.
    if (basis.scoredBaseline > 0) {
        const fresh = [...groups.entries()].filter(([p]) => !baselinePatterns.has(p)).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
        for (const [p, rows] of fresh) {
            const d = describe(rows);
            used.add(p);
            out.push({
                id: `new-${shortId(p)}`, type: 'NEW_ERROR',
                title: 'New kind of anomaly',
                summary: `The BGL cascade flagged ${rows.length} log(s) with a pattern it had not flagged in the previous ${BASELINE_DAYS} days: "${p}" (source: ${d.srcs.join(', ')}; mean anomaly score ${d.mean.toFixed(3)}).`,
                implication: 'A pattern that has never been anomalous before can be the first sign of a new problem.',
                investigationFilters: { keyword: keywordOf(p), source: d.source, level: d.level },
            });
        }
    }

    // 3) ANOMALY_CLUSTER: the largest groups of recent anomalies sharing one pattern (at least 3).
    const clusters = [...groups.entries()].filter(([p, rows]) => rows.length >= 3 && !used.has(p)).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
    for (const [p, rows] of clusters) {
        const d = describe(rows);
        out.push({
            id: `cluster-${shortId(p)}`, type: 'ANOMALY_CLUSTER',
            title: `${rows.length} anomalies with the same pattern`,
            summary: `In the last ${RECENT_HOURS} hours the BGL cascade flagged ${rows.length} logs that share one pattern: "${p}" (source: ${d.srcs.join(', ')}; mean anomaly score ${d.mean.toFixed(3)}).`,
            implication: 'Repeated anomalies of one kind usually come from one underlying fault; investigating one of them may explain all of them.',
            investigationFilters: { keyword: keywordOf(p), source: d.source, level: d.level },
        });
    }

    // 4) TREND: a source's anomaly RATE in the last 24 h at least twice its baseline rate (enough data both sides).
    for (const source of new Set(counts.map((c) => c.source))) {
        const r = counts.find((c) => c.source === source && c.win === 'recent');
        const b = counts.find((c) => c.source === source && c.win === 'base');
        if (!r || !b || r.scored < 50 || b.scored < 50 || r.anomalies < 5) continue;
        const rr = r.anomalies / r.scored, br = b.anomalies / b.scored;
        if (rr >= 2 * br) {
            out.push({
                id: `trend-${shortId(source)}`, type: 'TREND',
                title: `Anomaly rate rising in ${source}`,
                summary: `${pct(rr)} of ${source} logs (${r.anomalies} of ${r.scored}) were anomalies in the last ${RECENT_HOURS} hours, against ${pct(br)} (${b.anomalies} of ${b.scored}) in the previous ${BASELINE_DAYS} days.`,
                implication: 'A steadily rising share of anomalies suggests a gradual degradation rather than a one-off event.',
                investigationFilters: { source },
            });
        }
    }

    return { insights: out.slice(0, MAX_INSIGHTS), basis };
};
