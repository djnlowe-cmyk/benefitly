// Pure rules engine for coverage gap analysis. No DB access, no IO —
// callers (API routes, tests) pass in everything the engine needs and
// receive the full Gap[] in priority order.
//
// Rule families (priority order):
//   P1  exclusion             — explicit exclusion clause is high-impact
//   P2  missing_paired_category — user lacks a paired category (e.g. dental)
//   P3  low_limit             — parsed coverage limit below UK threshold
//   P4  high_excess           — excess > 10% of parsed limit (informational)

import {
  Coverage,
  CoverageCategory,
  Gap,
  GapEvaluationCounters,
  GapSeverity,
} from '@/types/coverage';
import { formatCurrency, RegionContext } from '@/lib/format';
import {
  CountryThresholds,
  HOME_PAIRINGS,
  HOME_BUILDINGS_TYPE_KEYWORD,
  HOME_CONTENTS_TYPE_KEYWORD,
  getThresholds,
  pairedCategoriesFor,
  parseLimit,
} from '@/data/gapThresholds';

export interface GapEvaluationSettings {
  // Region context drives both the threshold rows and currency formatting
  // in rationale strings. Defaults to GB.
  region?: RegionContext;
}

export interface GapEvaluationResult {
  gaps: Gap[];
  counters: GapEvaluationCounters;
}

function lc(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function typeContains(coverage: Pick<Coverage, 'type'>, keyword: string): boolean {
  return lc(coverage.type).includes(keyword);
}

function isActive(coverage: Pick<Coverage, 'status'>): boolean {
  return coverage.status === 'active' || coverage.status === 'expiring';
}

function someCovered(coverages: Coverage[], token: string): boolean {
  const needle = token.toLowerCase();
  return coverages.some((c) => {
    if (!isActive(c)) return false;
    return c.covered.some((entry) => entry.toLowerCase().includes(needle));
  });
}

function hasActiveCategory(
  coverages: Coverage[],
  category: CoverageCategory,
  excludingId?: string,
): boolean {
  return coverages.some(
    (c) => c.id !== excludingId && c.category === category && isActive(c),
  );
}

function hasActiveHomeType(
  coverages: Coverage[],
  typeKeyword: string,
  excludingId?: string,
): boolean {
  return coverages.some(
    (c) =>
      c.id !== excludingId &&
      c.category === 'home' &&
      isActive(c) &&
      typeContains(c, typeKeyword),
  );
}

// Severity for a low_limit gap based on how far below the threshold the
// parsed value is. <50% of threshold = high; 50–100% = medium.
function lowLimitSeverity(value: number, threshold: number): GapSeverity {
  if (value < threshold * 0.5) return 'high';
  return 'medium';
}

function buildExclusionGaps(
  coverage: Coverage,
  others: Coverage[],
  thresholds: CountryThresholds,
): { gaps: Gap[]; checked: number } {
  const gaps: Gap[] = [];
  let checked = 0;
  const seen = new Set<string>();
  const exclusions = coverage.exclusions.map((e) => e.toLowerCase());

  for (const kw of thresholds.exclusionKeywords) {
    checked += 1;
    if (seen.has(kw.key)) continue;
    const matched = exclusions.some((ex) => ex.includes(kw.token));
    if (!matched) continue;
    // Skip if any *other* active coverage advertises that token in covered[].
    if (someCovered(others, kw.token)) continue;
    seen.add(kw.key);
    gaps.push({
      key: `exclusion:${kw.key}`,
      category: 'exclusion',
      title: `${kw.label} exclusion`,
      rationale: `Your ${coverage.provider} ${coverage.type} policy explicitly excludes “${kw.label.toLowerCase()}”, and no other active policy you have lists it as covered.`,
      severity: kw.severity,
      action: {
        kind: 'search',
        target: `/search?q=${encodeURIComponent(`${kw.label} cover`)}`,
        label: `Find ${kw.label.toLowerCase()} cover`,
      },
    });
  }
  return { gaps, checked };
}

function buildPairedCategoryGaps(
  coverage: Coverage,
  others: Coverage[],
  thresholds: CountryThresholds,
): { gaps: Gap[]; checked: number } {
  const gaps: Gap[] = [];
  let checked = 0;

  // Standard paired categories (health → dental/vision, life → disability).
  for (const pair of pairedCategoriesFor(thresholds, coverage.category)) {
    checked += 1;
    if (hasActiveCategory(others, pair.paired, coverage.id)) continue;
    gaps.push({
      key: `missing_category:${pair.key}`,
      category: 'missing_paired_category',
      title: pair.title,
      rationale: pair.rationale,
      severity: 'medium',
      action: {
        kind: 'add',
        target: `/add?category=${pair.paired}`,
        label: `Add ${pair.paired} cover`,
      },
    });
  }

  // Home buildings <-> contents pairing detected by `type` keyword instead
  // of category, so a single user can hold either or both as separate
  // policies.
  if (coverage.category === 'home') {
    if (typeContains(coverage, HOME_BUILDINGS_TYPE_KEYWORD)) {
      checked += 1;
      if (!hasActiveHomeType(others, HOME_CONTENTS_TYPE_KEYWORD, coverage.id)) {
        const p = HOME_PAIRINGS.buildings;
        gaps.push({
          key: `missing_category:${p.key}`,
          category: 'missing_paired_category',
          title: p.title,
          rationale: p.rationale,
          severity: 'medium',
          action: {
            kind: 'add',
            target: `/add?category=home&type=contents`,
            label: 'Add contents cover',
          },
        });
      }
    } else if (typeContains(coverage, HOME_CONTENTS_TYPE_KEYWORD)) {
      checked += 1;
      if (!hasActiveHomeType(others, HOME_BUILDINGS_TYPE_KEYWORD, coverage.id)) {
        const p = HOME_PAIRINGS.contents;
        gaps.push({
          key: `missing_category:${p.key}`,
          category: 'missing_paired_category',
          title: p.title,
          rationale: p.rationale,
          severity: 'medium',
          action: {
            kind: 'add',
            target: `/add?category=home&type=buildings`,
            label: 'Add buildings cover',
          },
        });
      }
    }
  }

  return { gaps, checked };
}

function buildLowLimitGaps(
  coverage: Coverage,
  thresholds: CountryThresholds,
  region: RegionContext | undefined,
): { gaps: Gap[]; checked: number; parsedLimit: number | null } {
  const gaps: Gap[] = [];
  let checked = 0;
  const parsed = parseLimit(coverage.coverageLimit);
  // Conservative: cannot evaluate a limit we cannot parse.
  if (parsed == null) return { gaps, checked: 0, parsedLimit: null };

  for (const t of thresholds.categoryLimits) {
    if (t.category !== coverage.category) continue;
    if (t.typeKeyword && !typeContains(coverage, t.typeKeyword)) continue;
    checked += 1;
    if (parsed >= t.min) continue;
    const severity = lowLimitSeverity(parsed, t.min);
    gaps.push({
      key: `low_limit:${t.key}`,
      category: 'low_limit',
      title: 'Coverage limit below recommended',
      rationale: `Your ${t.rationaleNoun} parses to ${formatCurrency(parsed, region)}, which is below the ${formatCurrency(t.min, region)} we suggest as a UK floor for this kind of policy.`,
      severity,
      action: {
        kind: 'search',
        target: `/search?q=${encodeURIComponent(`top up ${t.rationaleNoun}`)}`,
        label: 'Look at top-up cover',
      },
    });
  }
  return { gaps, checked, parsedLimit: parsed };
}

function buildHighExcessGap(
  coverage: Coverage,
  parsedLimit: number | null,
  thresholds: CountryThresholds,
  region: RegionContext | undefined,
): Gap | null {
  if (parsedLimit == null) return null;
  if (coverage.deductible == null) return null;
  if (coverage.deductible <= 0) return null;
  if (parsedLimit <= 0) return null;
  const ratio = coverage.deductible / parsedLimit;
  if (ratio <= thresholds.highExcessRatio) return null;
  return {
    key: 'high_excess:deductible',
    category: 'high_excess',
    title: 'Excess is high relative to limit',
    rationale: `Your excess of ${formatCurrency(coverage.deductible, region)} is ${Math.round(ratio * 100)}% of the ${formatCurrency(parsedLimit, region)} coverage limit. You'd pay that out of pocket before this policy pays a claim.`,
    severity: 'low',
    action: null,
  };
}

export function evaluateGapsDetailed(
  coverage: Coverage,
  allUserCoverages: Coverage[],
  settings: GapEvaluationSettings = {},
): GapEvaluationResult {
  const region = settings.region;
  const thresholds = getThresholds(region?.country);

  const others = allUserCoverages.filter((c) => c.id !== coverage.id);

  const counters: GapEvaluationCounters = {
    exclusionsChecked: 0,
    limitsChecked: 0,
    pairedCategoriesChecked: 0,
  };

  const exclusion = buildExclusionGaps(coverage, allUserCoverages, thresholds);
  counters.exclusionsChecked = exclusion.checked;

  const paired = buildPairedCategoryGaps(coverage, others, thresholds);
  counters.pairedCategoriesChecked = paired.checked;

  const lowLimit = buildLowLimitGaps(coverage, thresholds, region);
  counters.limitsChecked = lowLimit.checked;

  const highExcess = buildHighExcessGap(coverage, lowLimit.parsedLimit, thresholds, region);

  const gaps: Gap[] = [
    ...exclusion.gaps,
    ...paired.gaps,
    ...lowLimit.gaps,
    ...(highExcess ? [highExcess] : []),
  ];

  return { gaps, counters };
}

export function evaluateGaps(
  coverage: Coverage,
  allUserCoverages: Coverage[],
  settings: GapEvaluationSettings = {},
): Gap[] {
  return evaluateGapsDetailed(coverage, allUserCoverages, settings).gaps;
}
