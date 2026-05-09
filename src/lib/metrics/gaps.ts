// Aggregation helpers for the /admin/metrics/gaps dashboard. Reads
// CoverageDetailView (fires) + CoverageGapDismissal (dismissals) and
// re-runs the gap engine over every active coverage to produce a fire
// snapshot. Pure read-side; safe to call from a server component.

import prisma from '@/lib/db';
import { evaluateGapsDetailed } from '@/lib/gaps/evaluate';
import type { Coverage } from '@/types/coverage';

export interface FireRow {
  gapKey: string;
  fired: number;
}

export interface DismissalRow {
  gapKey: string;
  dismissReason: string;
  dismissed: number;
}

export interface PerRuleRow {
  gapKey: string;
  fired: number;
  dismissed: number;
  dismissalRate: number; // 0..1
}

export interface EngagementRatio {
  detailViewers: number;
  dismissers: number;
  ratio: number; // dismissers / detailViewers, 0..1; 0 when no viewers
}

export interface DashboardSummary {
  fires: FireRow[];
  dismissals: DismissalRow[];
  perRule: PerRuleRow[];
  engagement: EngagementRatio;
  generatedAt: string;
}

interface CoverageRow {
  id: string;
  provider: string;
  type: string;
  category: string;
  policyNo: string | null;
  status: string;
  statusLabel: string;
  covered: string;
  startDate: string;
  endDate: string;
  premium: number;
  deductible: number | null;
  oopMax: number | null;
  coverageLimit: string | null;
  coInsurance: string | null;
  exclusions: string;
  claimPhone: string | null;
  claimUrl: string | null;
  summary: string | null;
  userId: string;
}

function rowToCoverage(row: CoverageRow): Coverage {
  return {
    id: row.id,
    provider: row.provider,
    type: row.type,
    category: row.category as Coverage['category'],
    policyNo: row.policyNo,
    status: row.status as Coverage['status'],
    statusLabel: row.statusLabel,
    covered: JSON.parse(row.covered) as string[],
    startDate: row.startDate,
    endDate: row.endDate,
    premium: row.premium,
    deductible: row.deductible,
    oopMax: row.oopMax,
    coverageLimit: row.coverageLimit,
    coInsurance: row.coInsurance,
    exclusions: JSON.parse(row.exclusions) as string[],
    claimPhone: row.claimPhone,
    claimUrl: row.claimUrl,
    summary: row.summary,
  };
}

/**
 * Re-run evaluateGapsDetailed over every active/expiring coverage in the
 * system, grouped by gapKey. Independent of the [gap_fired] log path —
 * gives an "if every user opened every detail page right now, how many
 * times would each rule fire" snapshot.
 *
 * Dismissed gaps are NOT subtracted here; this is the raw rule-fire
 * surface, which is the right denominator for a per-rule dismissal rate.
 */
export async function getFireSnapshot(): Promise<FireRow[]> {
  const rows = await prisma.coverage.findMany({
    where: { status: { in: ['active', 'expiring'] } },
  });
  const byUser = new Map<string, CoverageRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r as CoverageRow);
    byUser.set(r.userId, list);
  }

  const counts = new Map<string, number>();
  for (const list of byUser.values()) {
    const parsed = list.map(rowToCoverage);
    for (const target of parsed) {
      const { gaps } = evaluateGapsDetailed(target, parsed);
      for (const g of gaps) {
        counts.set(g.key, (counts.get(g.key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([gapKey, fired]) => ({ gapKey, fired }))
    .sort((a, b) => b.fired - a.fired || a.gapKey.localeCompare(b.gapKey));
}

/**
 * GROUP BY (gapKey, dismissReason) over CoverageGapDismissal.
 */
export async function getDismissalCounts(): Promise<DismissalRow[]> {
  const grouped = await prisma.coverageGapDismissal.groupBy({
    by: ['gapKey', 'dismissReason'],
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({
      gapKey: g.gapKey,
      dismissReason: g.dismissReason,
      dismissed: g._count._all,
    }))
    .sort(
      (a, b) =>
        b.dismissed - a.dismissed ||
        a.gapKey.localeCompare(b.gapKey) ||
        a.dismissReason.localeCompare(b.dismissReason),
    );
}

/**
 * Engagement = distinct users who dismissed at least one gap divided by
 * distinct users who hit at least one detail page. Returns 0 ratio when
 * there are no detail-page viewers (avoid div-by-zero on cold start).
 */
export async function getEngagementRatio(): Promise<EngagementRatio> {
  const [viewers, dismissers] = await Promise.all([
    prisma.coverageDetailView.findMany({
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.coverageGapDismissal.findMany({
      distinct: ['userId'],
      select: { userId: true },
    }),
  ]);
  const detailViewers = viewers.length;
  const dismissersCount = dismissers.length;
  const ratio = detailViewers === 0 ? 0 : dismissersCount / detailViewers;
  return { detailViewers, dismissers: dismissersCount, ratio };
}

/**
 * Per-rule cut: align fire and dismissal counts on the same gapKey, sum
 * dismiss reasons together. Dismissal rate = dismissed / max(fired, 1).
 * Dismissals without a matching fire (rare; possible if a user dismisses
 * then a rule changes) still surface with a synthetic 0 fire count so
 * the row is visible.
 */
export function composePerRule(
  fires: FireRow[],
  dismissals: DismissalRow[],
): PerRuleRow[] {
  const fireMap = new Map<string, number>();
  for (const f of fires) fireMap.set(f.gapKey, f.fired);

  const dismissMap = new Map<string, number>();
  for (const d of dismissals) {
    dismissMap.set(d.gapKey, (dismissMap.get(d.gapKey) ?? 0) + d.dismissed);
  }

  const allKeys = new Set<string>([...fireMap.keys(), ...dismissMap.keys()]);
  const rows: PerRuleRow[] = [];
  for (const key of allKeys) {
    const fired = fireMap.get(key) ?? 0;
    const dismissed = dismissMap.get(key) ?? 0;
    const denom = Math.max(fired, 1);
    rows.push({
      gapKey: key,
      fired,
      dismissed,
      dismissalRate: dismissed / denom,
    });
  }
  return rows.sort(
    (a, b) => b.fired - a.fired || a.gapKey.localeCompare(b.gapKey),
  );
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [fires, dismissals, engagement] = await Promise.all([
    getFireSnapshot(),
    getDismissalCounts(),
    getEngagementRatio(),
  ]);
  return {
    fires,
    dismissals,
    perRule: composePerRule(fires, dismissals),
    engagement,
    generatedAt: new Date().toISOString(),
  };
}
