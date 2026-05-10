import prisma from './db';

// Aggregations behind the AI cost & quality dashboard. Two views:
// - per-document: recent parses with cost / model / tokens / cache-hit %
// - per-user: 30-day rolling £/paying-user/mo with median + p90
// And the weekly-digest computation, including the £1.10 trip-wire flag
// (Phase-1 ceiling £1.20, target £0.50–£1.00, alert if median ≥ £1.10
// for two consecutive weeks even if inside cap).

export interface DocumentRow {
  documentId: string | null;
  filename: string | null;
  category: string | null;
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costPence: number;
  cacheHitRate: number; // 0–1; 0 when no cached read tokens
  successful: boolean;
  createdAt: Date;
  userEmail: string | null;
}

export interface UserRow {
  userId: string;
  email: string | null;
  callCount: number;
  totalPence: number;
  cacheHitRate: number;
}

export interface CohortStats {
  median: number;
  p90: number;
  mean: number;
  count: number;
  totalPence: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeStats(values: number[]): CohortStats {
  if (values.length === 0) {
    return { median: 0, p90: 0, mean: 0, count: 0, totalPence: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const totalPence = sorted.reduce((s, v) => s + v, 0);
  return {
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    mean: totalPence / sorted.length,
    count: sorted.length,
    totalPence,
  };
}

function cacheHitRate(reads: number, otherInput: number): number {
  const denom = reads + otherInput;
  if (denom === 0) return 0;
  return reads / denom;
}

// Per-document recent parses, newest first. We surface the document
// category by parsing parsedData.category (Document.parsedData stores
// the JSON returned by the parser). Bounded to `limit` for v1 — pagination
// is a v2 nicety once concierge volume grows past a single page.
export async function getDocumentRows(opts: { limit?: number } = {}): Promise<DocumentRow[]> {
  const limit = opts.limit ?? 200;
  const rows = await prisma.claudeUsage.findMany({
    where: { task: 'parse' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { email: true } },
      document: { select: { filename: true, parsedData: true } },
    },
  });
  return rows.map((r) => {
    let category: string | null = null;
    if (r.document?.parsedData) {
      try {
        const parsed = JSON.parse(r.document.parsedData);
        if (typeof parsed?.category === 'string') category = parsed.category;
      } catch {
        category = null;
      }
    }
    return {
      documentId: r.documentId,
      filename: r.document?.filename ?? null,
      category,
      task: r.task,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheCreationTokens: r.cacheCreationTokens,
      costPence: r.costPence,
      cacheHitRate: cacheHitRate(
        r.cacheReadTokens,
        r.inputTokens + r.cacheCreationTokens,
      ),
      successful: r.successful,
      createdAt: r.createdAt,
      userEmail: r.user?.email ?? null,
    };
  });
}

// Per-user rollup for the last `windowDays` days. We aggregate every
// task-type because the gross-margin question is "what does Claude cost
// per paying user" — so parse + search + re-extract all count.
export async function getUserRows(opts: { windowDays?: number } = {}): Promise<UserRow[]> {
  const windowDays = opts.windowDays ?? 30;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.claudeUsage.findMany({
    where: { createdAt: { gte: since } },
    include: { user: { select: { id: true, email: true } } },
  });
  const byUser = new Map<
    string,
    {
      email: string | null;
      count: number;
      totalPence: number;
      cacheReads: number;
      otherInput: number;
    }
  >();
  for (const r of rows) {
    const cur = byUser.get(r.userId) ?? {
      email: r.user?.email ?? null,
      count: 0,
      totalPence: 0,
      cacheReads: 0,
      otherInput: 0,
    };
    cur.count += 1;
    cur.totalPence += r.costPence;
    cur.cacheReads += r.cacheReadTokens;
    cur.otherInput += r.inputTokens + r.cacheCreationTokens;
    byUser.set(r.userId, cur);
  }
  return Array.from(byUser.entries())
    .map(([userId, v]) => ({
      userId,
      email: v.email,
      callCount: v.count,
      totalPence: v.totalPence,
      cacheHitRate: cacheHitRate(v.cacheReads, v.otherInput),
    }))
    .sort((a, b) => b.totalPence - a.totalPence);
}

// "Paying-user" is a v1 simplification: any user with ≥1 Claude call in the
// window counts. When billing lands, replace this filter with a join against
// the subscriptions table — the dashboard's spec for "paying user" will then
// be accurate without any change to the digest logic.
export async function getCohortStats(opts: { windowDays?: number } = {}): Promise<CohortStats> {
  const userRows = await getUserRows(opts);
  return computeStats(userRows.map((u) => u.totalPence));
}

export interface DigestSnapshot {
  windowStart: Date;
  windowEnd: Date;
  cohort: CohortStats;
  cacheHitRate: number;
}

export async function getWeeklySnapshot(opts: { weeksAgo: number }): Promise<DigestSnapshot> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  // Window 0 = the most recent 7d ending now. weeksAgo=1 = the prior 7d, etc.
  // Use `lte` for the boundary so a row created in the same second the cron
  // runs still lands in the current window — sqlite's CURRENT_TIMESTAMP is
  // second-precision, which makes a strict `lt` flaky in tests.
  const windowEnd = new Date(now - opts.weeksAgo * weekMs);
  const windowStart = new Date(windowEnd.getTime() - weekMs);

  // Half-open interval (windowStart, windowEnd] so a row at exactly
  // windowEnd lands in the older window only — no double-counting.
  const rows = await prisma.claudeUsage.findMany({
    where: { createdAt: { gt: windowStart, lte: windowEnd } },
    select: {
      userId: true,
      costPence: true,
      cacheReadTokens: true,
      inputTokens: true,
      cacheCreationTokens: true,
    },
  });
  const totals = new Map<string, number>();
  let cacheReads = 0;
  let otherInput = 0;
  for (const r of rows) {
    totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.costPence);
    cacheReads += r.cacheReadTokens;
    otherInput += r.inputTokens + r.cacheCreationTokens;
  }
  const cohort = computeStats(Array.from(totals.values()));
  return {
    windowStart,
    windowEnd,
    cohort,
    cacheHitRate: cacheHitRate(cacheReads, otherInput),
  };
}

// CEO framing (ALI-121 issue body): steady-state target £0.50–£1.00 per
// paying-user/mo, Phase-1 ceiling £1.20, Phase-2 ceiling £1.50. If median
// sits at £1.10+ for two consecutive weeks, surface on the weekly review
// even when inside cap. Keep these constants here so the digest, the
// dashboard, and any future budget alarm share one source of truth.
export const COST_THRESHOLDS_PENCE = {
  targetLow: 50,
  targetHigh: 100,
  phase1Cap: 120,
  phase2Cap: 150,
  tripWire: 110,
} as const;

export interface DigestReport {
  current: DigestSnapshot;
  previous: DigestSnapshot;
  weekOverWeekDeltaPence: number;
  weekOverWeekDeltaPct: number; // 0 when previous median is 0
  thresholds: typeof COST_THRESHOLDS_PENCE;
  tripWireBreached: boolean;
  tripWireConsecutive: boolean;
  overPhase1Cap: boolean;
}

export async function buildDigestReport(): Promise<DigestReport> {
  const [current, previous] = await Promise.all([
    getWeeklySnapshot({ weeksAgo: 0 }),
    getWeeklySnapshot({ weeksAgo: 1 }),
  ]);
  const wowAbs = current.cohort.median - previous.cohort.median;
  const wowPct = previous.cohort.median === 0 ? 0 : wowAbs / previous.cohort.median;
  const tripWireBreached = current.cohort.median >= COST_THRESHOLDS_PENCE.tripWire;
  const previousBreached = previous.cohort.median >= COST_THRESHOLDS_PENCE.tripWire;
  return {
    current,
    previous,
    weekOverWeekDeltaPence: wowAbs,
    weekOverWeekDeltaPct: wowPct,
    thresholds: COST_THRESHOLDS_PENCE,
    tripWireBreached,
    tripWireConsecutive: tripWireBreached && previousBreached,
    overPhase1Cap: current.cohort.median > COST_THRESHOLDS_PENCE.phase1Cap,
  };
}

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
