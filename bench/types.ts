// Day-1 Benefitly parse-quality benchmark — type contracts.
//
// Why these are separate from `src/types/coverage.ts`: the benchmark scope
// (categories we commit to a 15% per-field ceiling on) is a product-quality
// commitment, not a schema. Keeping the lists here keeps the contract that
// changes when we widen the ceiling commitment, not the coverage model.

export const DAY1_CATEGORIES = [
  'home',
  'auto',
  'travel',
  'mobile-warranty',
  'whitegoods-warranty',
  'creditcard',
  'employer-benefits',
] as const;
export type Day1Category = (typeof DAY1_CATEGORIES)[number];

export const DAY1_FIELDS = [
  'provider',
  'type',
  'category',
  'policyNo',
  'covered',
  'startDate',
  'endDate',
  'premium',
  'deductible',
  'oopMax',
  'coverageLimit',
  'coInsurance',
  'exclusions',
  'claimPhone',
  'claimUrl',
  'summary',
] as const;
export type Day1Field = (typeof DAY1_FIELDS)[number];

// Per-field correction-rate ceiling. >15% on any Day-1 category fails CI.
export const CORRECTION_RATE_CEILING = 0.15;

// A category is only ceiling-enforced once it has this many scored docs.
// Below this we report the rate but do not fail CI — too noisy.
export const MIN_DOCS_FOR_CEILING_ENFORCEMENT = 5;

export interface CorpusManifestEntry {
  id: string;
  category: Day1Category;
  // 'fixture' = pre-recorded parser response in bench/fixtures/<storageKey>.json.
  //             Used by CI smoke + offline development so the harness is
  //             exercisable without GCS or the live Claude API.
  // 'storage' = real PDF in the configured corpus storage backend (GCS in
  //             prod, local FS in dev). Hit live Claude with --mode=live.
  source: 'fixture' | 'storage';
  storageKey: string;
  groundTruthKey: string;
  notes?: string;
}

export interface CorpusManifest {
  // Bumped when the field list, category list, or ceiling rule changes —
  // baselines from a different version cannot be diffed apples-to-apples.
  manifestVersion: '1';
  // The prompt version the manifest's ground truth was labelled against.
  // The harness refuses to score a doc whose live prompt version differs.
  expectedPromptVersion: string;
  entries: CorpusManifestEntry[];
}

export type GroundTruthValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[];

// Ground truth is a partial — fields the labeller did not annotate are
// skipped during scoring (vs. fields explicitly set to null, which mean
// "correctly absent from source"). Lets us label incrementally.
export interface GroundTruth {
  docId: string;
  category: Day1Category;
  promptVersion: string;
  fields: Partial<Record<Day1Field, GroundTruthValue>>;
  labeller?: string;
  labelledAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface FieldOutcome {
  expected: GroundTruthValue;
  extracted: unknown;
  correct: boolean;
}

export interface DocResult {
  docId: string;
  category: Day1Category;
  model: string;
  promptVersion: string;
  latencyMs: number;
  costDeciPence: number | null;
  errorCode: string | null;
  // null entries = field not labelled in ground truth, skipped from scoring.
  fieldOutcomes: Partial<Record<Day1Field, FieldOutcome>>;
}

export interface CategoryFieldRate {
  scoredDocs: number;
  incorrectDocs: number;
  correctionRate: number;
}

export interface CategoryReport {
  category: Day1Category;
  docCount: number;
  fields: Partial<Record<Day1Field, CategoryFieldRate>>;
  worstFieldRate: number;
  worstField: Day1Field | null;
  exceedsCeiling: boolean;
  enforcementSkippedReason: string | null;
}

export interface LatencyStats {
  p50: number;
  p95: number;
  max: number;
}

// Quality-only payload — deterministic given (manifest, model, prompt, ground
// truth, parser responses). This is what the diff is computed against. Cost,
// latency, and generated-at live alongside in BenchReport but are stripped
// before equality checks in tests.
export interface QualityReport {
  reportVersion: '1';
  manifestVersion: '1';
  promptVersion: string;
  totalDocs: number;
  categories: CategoryReport[];
  failedCategories: Day1Category[];
  ceiling: number;
  minDocsForEnforcement: number;
}

export interface BenchReport extends QualityReport {
  generatedAt: string;
  modelDistribution: Record<string, number>;
  totalCostDeciPence: number;
  // null when at least one model in the run lacked pricing — we still emit
  // a report but the cost rollup is incomplete and flagged in the README.
  costPerDocDeciPence: number | null;
  latencyMs: LatencyStats;
  unknownPricingModels: string[];
}
