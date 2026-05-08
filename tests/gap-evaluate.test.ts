import { describe, expect, it } from 'vitest';
import { evaluateGaps, evaluateGapsDetailed } from '@/lib/gaps/evaluate';
import { parseLimit } from '@/data/gapThresholds';
import type { Coverage, CoverageCategory, CoverageStatus } from '@/types/coverage';

// UK seed-style fixture builder. The test corpus is intentionally small so
// each rule family can be exercised in isolation.

function coverage(overrides: Partial<Coverage> & { id: string; category: CoverageCategory }): Coverage {
  const status: CoverageStatus = overrides.status ?? 'active';
  return {
    id: overrides.id,
    provider: overrides.provider ?? 'Aviva',
    type: overrides.type ?? 'Home',
    category: overrides.category,
    policyNo: overrides.policyNo ?? null,
    status,
    statusLabel: overrides.statusLabel ?? 'Active',
    covered: overrides.covered ?? [],
    startDate: overrides.startDate ?? '2026-01-01',
    endDate: overrides.endDate ?? '2026-12-31',
    premium: overrides.premium ?? 0,
    deductible: overrides.deductible ?? null,
    oopMax: overrides.oopMax ?? null,
    coverageLimit: overrides.coverageLimit ?? null,
    coInsurance: overrides.coInsurance ?? null,
    exclusions: overrides.exclusions ?? [],
    claimPhone: overrides.claimPhone ?? null,
    claimUrl: overrides.claimUrl ?? null,
    summary: overrides.summary ?? null,
  };
}

describe('parseLimit', () => {
  it('parses UK-style currency strings', () => {
    expect(parseLimit('£250,000')).toBe(250000);
    expect(parseLimit('£1,000,000')).toBe(1_000_000);
    expect(parseLimit('£15k')).toBe(15_000);
    expect(parseLimit('2m')).toBe(2_000_000);
    expect(parseLimit('  £250  ')).toBe(250);
  });

  it('returns null for unparseable input — engine must skip the rule', () => {
    expect(parseLimit(null)).toBeNull();
    expect(parseLimit(undefined)).toBeNull();
    expect(parseLimit('')).toBeNull();
    expect(parseLimit('see schedule')).toBeNull();
    expect(parseLimit('zero')).toBeNull();
  });
});

describe('evaluateGaps — P1 explicit exclusion', () => {
  it('flags a flood exclusion when no other policy advertises flood cover', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home buildings',
      provider: 'Aviva',
      exclusions: ['Flood damage', 'Wear and tear'],
    });
    const gaps = evaluateGaps(home, [home]);
    const flood = gaps.find((g) => g.key === 'exclusion:flood');
    expect(flood).toBeDefined();
    expect(flood?.severity).toBe('high');
    expect(flood?.rationale).toContain('Aviva');
    expect(flood?.action?.target).toContain('Flood');
  });

  it('does not flag an exclusion that another active policy explicitly covers', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home buildings',
      exclusions: ['Flood damage'],
    });
    const flood = coverage({
      id: 'f1',
      category: 'home',
      type: 'Standalone flood',
      covered: ['Flood damage to property'],
    });
    const gaps = evaluateGaps(home, [home, flood]);
    expect(gaps.find((g) => g.key === 'exclusion:flood')).toBeUndefined();
  });

  it('still flags when the other policy is expired', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home buildings',
      exclusions: ['Flood damage'],
    });
    const flood = coverage({
      id: 'f1',
      category: 'home',
      type: 'Standalone flood',
      status: 'expired',
      covered: ['Flood damage to property'],
    });
    const gaps = evaluateGaps(home, [home, flood]);
    expect(gaps.find((g) => g.key === 'exclusion:flood')).toBeDefined();
  });
});

describe('evaluateGaps — P2 missing paired category', () => {
  it('flags a dental gap when user has health but no dental', () => {
    const health = coverage({
      id: 'h1',
      category: 'health',
      type: 'Private medical',
    });
    const gaps = evaluateGaps(health, [health]);
    const dental = gaps.find((g) => g.key === 'missing_category:dental');
    expect(dental).toBeDefined();
    expect(dental?.severity).toBe('medium');
    expect(dental?.action?.target).toBe('/add?category=dental');
  });

  it('suppresses dental gap when user already has an active dental policy', () => {
    const health = coverage({ id: 'h1', category: 'health', type: 'Private medical' });
    const dental = coverage({ id: 'd1', category: 'dental', type: 'Dental' });
    const gaps = evaluateGaps(health, [health, dental]);
    expect(gaps.find((g) => g.key === 'missing_category:dental')).toBeUndefined();
  });

  it('flags a contents gap when user has buildings-only home cover', () => {
    const buildings = coverage({
      id: 'b1',
      category: 'home',
      type: 'Home buildings',
    });
    const gaps = evaluateGaps(buildings, [buildings]);
    expect(gaps.find((g) => g.key === 'missing_category:buildings_contents')).toBeDefined();
  });

  it('does not flag contents gap when a contents policy already exists', () => {
    const buildings = coverage({ id: 'b1', category: 'home', type: 'Home buildings' });
    const contents = coverage({ id: 'c1', category: 'home', type: 'Home contents' });
    const gaps = evaluateGaps(buildings, [buildings, contents]);
    expect(gaps.find((g) => g.key === 'missing_category:buildings_contents')).toBeUndefined();
  });
});

describe('evaluateGaps — P3 low coverage limit', () => {
  it('flags a low contents limit and scales severity by ratio', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home contents',
      coverageLimit: '£5,000',
    });
    const gaps = evaluateGaps(home, [home]);
    const low = gaps.find((g) => g.key === 'low_limit:home_contents');
    expect(low).toBeDefined();
    // 5000 / 20000 = 0.25 → high
    expect(low?.severity).toBe('high');
    expect(low?.rationale).toContain('£5,000');
    expect(low?.rationale).toContain('£20,000');
  });

  it('reports medium severity when value is between 50-100% of threshold', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home contents',
      coverageLimit: '£15,000',
    });
    const gaps = evaluateGaps(home, [home]);
    const low = gaps.find((g) => g.key === 'low_limit:home_contents');
    expect(low?.severity).toBe('medium');
  });

  it('does not flag when the limit is at or above the floor', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home contents',
      coverageLimit: '£25,000',
    });
    const gaps = evaluateGaps(home, [home]);
    expect(gaps.find((g) => g.key === 'low_limit:home_contents')).toBeUndefined();
  });

  it('skips the rule when coverageLimit cannot be parsed', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home contents',
      coverageLimit: 'see schedule',
    });
    const gaps = evaluateGaps(home, [home]);
    expect(gaps.find((g) => g.key.startsWith('low_limit:'))).toBeUndefined();
  });
});

describe('evaluateGaps — P4 high excess', () => {
  it('flags when deductible is more than 10% of parsed limit', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home buildings',
      coverageLimit: '£200,000',
      deductible: 50_000, // 25% of 200k → high excess
    });
    const gaps = evaluateGaps(home, [home]);
    const excess = gaps.find((g) => g.key === 'high_excess:deductible');
    expect(excess).toBeDefined();
    expect(excess?.severity).toBe('low');
    expect(excess?.rationale).toContain('25%');
  });

  it('does not flag when ratio is at or below 10%', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home buildings',
      coverageLimit: '£200,000',
      deductible: 20_000,
    });
    const gaps = evaluateGaps(home, [home]);
    expect(gaps.find((g) => g.key === 'high_excess:deductible')).toBeUndefined();
  });

  it('skips when limit is unparseable (cannot compute ratio confidently)', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home buildings',
      coverageLimit: 'see schedule',
      deductible: 50_000,
    });
    const gaps = evaluateGaps(home, [home]);
    expect(gaps.find((g) => g.key === 'high_excess:deductible')).toBeUndefined();
  });
});

describe('evaluateGaps — counters and ordering', () => {
  it('returns gaps in P1 → P2 → P3 → P4 priority order', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home contents',
      coverageLimit: '£5,000',
      deductible: 1_000, // 20% of 5k
      exclusions: ['Accidental damage'],
    });
    const gaps = evaluateGaps(home, [home]);
    const categories = gaps.map((g) => g.category);
    // First should be exclusion, last should be high_excess.
    expect(categories[0]).toBe('exclusion');
    expect(categories[categories.length - 1]).toBe('high_excess');
  });

  it('reports counters used by the empty-state copy', () => {
    const auto = coverage({
      id: 'a1',
      category: 'auto',
      type: 'Motor',
      coverageLimit: '£250,000',
    });
    const { counters } = evaluateGapsDetailed(auto, [auto]);
    expect(counters.exclusionsChecked).toBeGreaterThan(0);
    expect(counters.pairedCategoriesChecked).toBe(0);
    // No category limit row applies to auto, so 0.
    expect(counters.limitsChecked).toBe(0);
  });
});

describe('evaluateGaps — dismissal filter (caller-applied)', () => {
  it('the engine itself returns all gaps; dismissals are layered by the caller', () => {
    const home = coverage({
      id: 'h1',
      category: 'home',
      type: 'Home contents',
      coverageLimit: '£5,000',
      exclusions: ['Flood'],
    });
    const allGaps = evaluateGaps(home, [home]);
    const dismissed = new Set(['exclusion:flood']);
    const visible = allGaps.filter((g) => !dismissed.has(g.key));
    expect(allGaps.find((g) => g.key === 'exclusion:flood')).toBeDefined();
    expect(visible.find((g) => g.key === 'exclusion:flood')).toBeUndefined();
    // Other gaps still present.
    expect(visible.find((g) => g.key === 'low_limit:home_contents')).toBeDefined();
  });
});
