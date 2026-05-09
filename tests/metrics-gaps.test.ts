import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import prisma from '@/lib/db';
import {
  composePerRule,
  getDashboardSummary,
  getDismissalCounts,
  getEngagementRatio,
  getFireSnapshot,
} from '@/lib/metrics/gaps';

type Fixture = { userA: string; userB: string };
const fixture: Partial<Fixture> = {};

async function clearDomain() {
  await prisma.coverageDetailView.deleteMany();
  await prisma.coverageGapDismissal.deleteMany();
  await prisma.coverage.deleteMany();
}

async function createCoverage(userId: string, overrides: Record<string, unknown> = {}) {
  return prisma.coverage.create({
    data: {
      provider: (overrides.provider as string) ?? 'Aviva',
      type: (overrides.type as string) ?? 'Home contents',
      category: (overrides.category as string) ?? 'home',
      covered: JSON.stringify(overrides.covered ?? []),
      exclusions: JSON.stringify(overrides.exclusions ?? []),
      coverageLimit: (overrides.coverageLimit as string | null) ?? null,
      deductible: (overrides.deductible as number | null) ?? null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      userId,
      ...(overrides.status ? { status: overrides.status as string } : {}),
    },
  });
}

beforeAll(async () => {
  const a = await prisma.user.create({
    data: { email: 'metrics-a@example.test', name: 'M A', passwordHash: 'x' },
  });
  const b = await prisma.user.create({
    data: { email: 'metrics-b@example.test', name: 'M B', passwordHash: 'x' },
  });
  fixture.userA = a.id;
  fixture.userB = b.id;
});

beforeEach(async () => {
  await clearDomain();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('getFireSnapshot', () => {
  it('returns empty list when no coverages exist', async () => {
    expect(await getFireSnapshot()).toEqual([]);
  });

  it('groups fires by gapKey across users (single-rule case)', async () => {
    // Both users have a home contents policy that excludes flood. Both
    // fire exclusion:flood once.
    await createCoverage(fixture.userA!, { exclusions: ['Flood damage'] });
    await createCoverage(fixture.userB!, { exclusions: ['Flood damage'] });

    const snapshot = await getFireSnapshot();
    const flood = snapshot.find((r) => r.gapKey === 'exclusion:flood');
    expect(flood?.fired).toBe(2);
  });

  it('skips inactive coverages', async () => {
    await createCoverage(fixture.userA!, {
      exclusions: ['Flood damage'],
      status: 'expired',
    });
    expect(await getFireSnapshot()).toEqual([]);
  });

  it('counts every distinct gapKey that fires (multi-key)', async () => {
    await createCoverage(fixture.userA!, {
      provider: 'Aviva',
      type: 'Home contents',
      category: 'home',
      covered: [],
      exclusions: ['Flood damage', 'Accidental damage'],
      coverageLimit: '£5,000',
    });

    const snapshot = await getFireSnapshot();
    const keys = snapshot.map((r) => r.gapKey).sort();
    expect(keys).toContain('exclusion:flood');
    expect(keys).toContain('exclusion:accidental_damage');
    expect(keys).toContain('low_limit:home_contents');
    // Each rule fired exactly once for the single coverage we created.
    for (const row of snapshot) {
      expect(row.fired).toBe(1);
    }
  });
});

describe('getDismissalCounts', () => {
  it('returns empty list when nothing has been dismissed', async () => {
    expect(await getDismissalCounts()).toEqual([]);
  });

  it('groups by (gapKey, dismissReason)', async () => {
    const cov = await createCoverage(fixture.userA!, { exclusions: ['Flood damage'] });
    await prisma.coverageGapDismissal.create({
      data: {
        userId: fixture.userA!,
        coverageId: cov.id,
        gapKey: 'exclusion:flood',
        dismissReason: 'have_elsewhere',
      },
    });
    const cov2 = await createCoverage(fixture.userB!, { exclusions: ['Flood damage'] });
    await prisma.coverageGapDismissal.create({
      data: {
        userId: fixture.userB!,
        coverageId: cov2.id,
        gapKey: 'exclusion:flood',
        dismissReason: 'not_relevant',
      },
    });

    const rows = await getDismissalCounts();
    const haveElsewhere = rows.find(
      (r) => r.gapKey === 'exclusion:flood' && r.dismissReason === 'have_elsewhere',
    );
    const notRelevant = rows.find(
      (r) => r.gapKey === 'exclusion:flood' && r.dismissReason === 'not_relevant',
    );
    expect(haveElsewhere?.dismissed).toBe(1);
    expect(notRelevant?.dismissed).toBe(1);
  });
});

describe('getEngagementRatio', () => {
  it('returns zero ratio with no detail viewers (avoid div-by-zero)', async () => {
    const r = await getEngagementRatio();
    expect(r).toEqual({ detailViewers: 0, dismissers: 0, ratio: 0 });
  });

  it('counts distinct viewers and dismissers', async () => {
    const cov = await createCoverage(fixture.userA!, { exclusions: ['Flood damage'] });
    // userA loaded the detail page twice (two views, but counted as one
    // distinct viewer).
    await prisma.coverageDetailView.createMany({
      data: [
        { userId: fixture.userA!, coverageId: cov.id, firedGapCount: 1 },
        { userId: fixture.userA!, coverageId: cov.id, firedGapCount: 1 },
      ],
    });
    // userB loaded the detail page once but never dismissed anything.
    const covB = await createCoverage(fixture.userB!, { exclusions: ['Flood damage'] });
    await prisma.coverageDetailView.create({
      data: { userId: fixture.userB!, coverageId: covB.id, firedGapCount: 1 },
    });
    // Only userA dismissed.
    await prisma.coverageGapDismissal.create({
      data: {
        userId: fixture.userA!,
        coverageId: cov.id,
        gapKey: 'exclusion:flood',
        dismissReason: 'have_elsewhere',
      },
    });

    const r = await getEngagementRatio();
    expect(r.detailViewers).toBe(2);
    expect(r.dismissers).toBe(1);
    expect(r.ratio).toBeCloseTo(0.5, 5);
  });
});

describe('composePerRule', () => {
  it('aligns fires + dismissals on gapKey and computes per-rule dismissal rate', () => {
    const fires = [
      { gapKey: 'exclusion:flood', fired: 4 },
      { gapKey: 'low_limit:home_contents', fired: 2 },
    ];
    const dismissals = [
      { gapKey: 'exclusion:flood', dismissReason: 'have_elsewhere', dismissed: 1 },
      { gapKey: 'exclusion:flood', dismissReason: 'not_relevant', dismissed: 1 },
    ];
    const rows = composePerRule(fires, dismissals);
    const flood = rows.find((r) => r.gapKey === 'exclusion:flood')!;
    expect(flood.fired).toBe(4);
    expect(flood.dismissed).toBe(2);
    expect(flood.dismissalRate).toBeCloseTo(0.5, 5);
    const lowLimit = rows.find((r) => r.gapKey === 'low_limit:home_contents')!;
    expect(lowLimit.dismissalRate).toBe(0);
  });

  it('surfaces dismissals without a matching fire as fired=0 rows', () => {
    const rows = composePerRule(
      [],
      [{ gapKey: 'exclusion:flood', dismissReason: 'have_elsewhere', dismissed: 3 }],
    );
    const flood = rows.find((r) => r.gapKey === 'exclusion:flood')!;
    expect(flood.fired).toBe(0);
    expect(flood.dismissed).toBe(3);
  });
});

describe('getDashboardSummary', () => {
  it('composes all four cuts with consistent totals', async () => {
    const covA = await createCoverage(fixture.userA!, { exclusions: ['Flood damage'] });
    const covB = await createCoverage(fixture.userB!, { exclusions: ['Flood damage'] });

    await prisma.coverageDetailView.createMany({
      data: [
        { userId: fixture.userA!, coverageId: covA.id, firedGapCount: 1 },
        { userId: fixture.userB!, coverageId: covB.id, firedGapCount: 1 },
      ],
    });
    await prisma.coverageGapDismissal.create({
      data: {
        userId: fixture.userA!,
        coverageId: covA.id,
        gapKey: 'exclusion:flood',
        dismissReason: 'have_elsewhere',
      },
    });

    const summary = await getDashboardSummary();
    expect(summary.fires.find((r) => r.gapKey === 'exclusion:flood')?.fired).toBe(2);
    expect(summary.dismissals.find((r) => r.gapKey === 'exclusion:flood')?.dismissed).toBe(1);
    expect(summary.engagement.detailViewers).toBe(2);
    expect(summary.engagement.dismissers).toBe(1);
    const flood = summary.perRule.find((r) => r.gapKey === 'exclusion:flood')!;
    expect(flood.fired).toBe(2);
    expect(flood.dismissed).toBe(1);
    expect(flood.dismissalRate).toBeCloseTo(0.5, 5);
  });
});
