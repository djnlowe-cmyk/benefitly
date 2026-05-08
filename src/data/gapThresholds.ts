// Tunable gap-evaluation data: keyword lists, paired-category mappings,
// and per-category limit/excess thresholds. Structured per-country so we
// can add non-UK rows later without touching the rules engine.

import { CoverageCategory } from '@/types/coverage';

export type Severity = 'high' | 'medium' | 'low';

export interface ExclusionKeyword {
  // The token we expect to find inside an exclusion clause OR a covered[]
  // entry, lower-cased and matched as a substring.
  token: string;
  // Stable suffix used inside the gap key (e.g. "exclusion:flood").
  // Kept stable across spelling variants so dismissals survive re-parsing.
  key: string;
  // User-readable label used in the gap title.
  label: string;
  severity: Severity;
}

export interface PairedCategory {
  // The detail-page coverage category that triggers the check.
  parent: CoverageCategory;
  // The category the user is missing.
  paired: CoverageCategory;
  // Stable key suffix (e.g. "missing_category:dental").
  key: string;
  // Title and rationale fragments — currency formatting is left to the engine.
  title: string;
  rationale: string;
  searchTerm: string;
}

export interface CategoryLimitThreshold {
  // Minimum acceptable parsed limit, in the country's primary currency unit.
  // Below this is "low_limit" with severity scaled by ratio.
  min: number;
  // The category the threshold applies to.
  category: CoverageCategory;
  // Optional type keyword that further narrows the rule, e.g.
  // home + "contents". When set, the coverage's `type` must contain this
  // keyword (case-insensitive) for the threshold to apply.
  typeKeyword?: string;
  // Stable key suffix.
  key: string;
  // Short rationale fragment (currency injected by engine).
  rationaleNoun: string;
}

export interface CountryThresholds {
  country: string;
  exclusionKeywords: ExclusionKeyword[];
  pairedCategories: PairedCategory[];
  categoryLimits: CategoryLimitThreshold[];
  // Excess/limit ratio above which we surface a P4 high-excess note.
  highExcessRatio: number;
}

const UK: CountryThresholds = {
  country: 'GB',
  exclusionKeywords: [
    { token: 'flood',              key: 'flood',             label: 'Flood',                  severity: 'high'   },
    { token: 'earthquake',         key: 'earthquake',        label: 'Earthquake',             severity: 'high'   },
    { token: 'accidental damage',  key: 'accidental_damage', label: 'Accidental damage',      severity: 'high'   },
    { token: 'liability',          key: 'liability',         label: 'Liability',              severity: 'high'   },
    { token: 'mental health',      key: 'mental_health',     label: 'Mental health',          severity: 'medium' },
    { token: 'dental',             key: 'dental',            label: 'Dental',                 severity: 'medium' },
    { token: 'vision',             key: 'vision',            label: 'Vision',                 severity: 'medium' },
    { token: 'optical',            key: 'optical',           label: 'Optical',                severity: 'medium' },
    { token: 'wear and tear',      key: 'wear_and_tear',     label: 'Wear and tear',          severity: 'medium' },
  ],
  pairedCategories: [
    {
      parent: 'health',
      paired: 'dental',
      key: 'dental',
      title: 'Dental gap',
      rationale: 'You have private medical cover but no active dental policy. NHS dental waits are long; private dental usually pays for routine and emergency work.',
      searchTerm: 'dental',
    },
    {
      parent: 'health',
      paired: 'vision',
      key: 'vision',
      title: 'Vision gap',
      rationale: 'You have private medical cover but no active optical/vision policy. Eye tests, glasses, and contact lenses are typically excluded from PMI.',
      searchTerm: 'vision',
    },
    {
      parent: 'life',
      paired: 'disability',
      key: 'disability',
      title: 'Income protection gap',
      rationale: 'You have life cover but no income protection. Statutory Sick Pay is just over £100/week — most households need cover for long-term illness, not only death.',
      searchTerm: 'income+protection',
    },
  ],
  categoryLimits: [
    {
      category: 'home',
      typeKeyword: 'contents',
      min: 20000,
      key: 'home_contents',
      rationaleNoun: 'home contents cover',
    },
    {
      category: 'life',
      min: 50000,
      key: 'life',
      rationaleNoun: 'life cover',
    },
    {
      category: 'business',
      typeKeyword: 'liability',
      min: 1000000,
      key: 'public_liability',
      rationaleNoun: 'public liability cover',
    },
  ],
  highExcessRatio: 0.10,
};

const COUNTRY_THRESHOLDS: Record<string, CountryThresholds> = {
  GB: UK,
};

export function getThresholds(country: string | null | undefined): CountryThresholds {
  return COUNTRY_THRESHOLDS[country ?? 'GB'] ?? UK;
}

// Detected paired pairs for a given parent category and (optional) type keyword.
export function pairedCategoriesFor(
  thresholds: CountryThresholds,
  category: CoverageCategory,
): PairedCategory[] {
  return thresholds.pairedCategories.filter((p) => p.parent === category);
}

export const HOME_BUILDINGS_TYPE_KEYWORD = 'buildings';
export const HOME_CONTENTS_TYPE_KEYWORD = 'contents';

export interface HomeContentsPairing {
  key: 'buildings_contents' | 'contents_buildings';
  title: string;
  rationale: string;
  searchTerm: string;
}

export const HOME_PAIRINGS: Record<'buildings' | 'contents', HomeContentsPairing> = {
  buildings: {
    key: 'buildings_contents',
    title: 'Contents gap',
    rationale: 'You have buildings cover but no contents policy. Buildings insurance does not cover what is inside the property — furniture, electronics, valuables.',
    searchTerm: 'home+contents',
  },
  contents: {
    key: 'contents_buildings',
    title: 'Buildings gap',
    rationale: 'You have contents cover but no buildings policy. If you own the property, buildings insurance is usually a mortgage requirement and protects the structure itself.',
    searchTerm: 'home+buildings',
  },
};

// Parse a free-text limit string like "£250,000", "$50k", "1,000,000" into
// a number. Returns null when the input is missing, empty, or too ambiguous
// to be useful — the rules engine MUST treat null as "skip the rule for
// this coverage" rather than guessing.
export function parseLimit(input: string | null | undefined): number | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  // Strip currency symbols and letters except for k/m suffix handling later.
  const lowered = trimmed.toLowerCase();
  // Find the first numeric run, optionally with thousands separators or decimals.
  const match = lowered.match(/(\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const intPart = match[1].replace(/[, ]/g, '');
  const decPart = match[2];
  const numeric = decPart ? `${intPart}.${decPart}` : intPart;
  const value = Number(numeric);
  if (!Number.isFinite(value) || value <= 0) return null;

  // Suffix multipliers — only apply when they immediately follow the number
  // (allowing a space) to avoid catching unrelated letters elsewhere in the
  // string.
  const tail = lowered.slice((match.index ?? 0) + match[0].length).trimStart();
  if (tail.startsWith('m')) return value * 1_000_000;
  if (tail.startsWith('k')) return value * 1_000;

  return value;
}
