// Pure scoring logic — no I/O, deterministic, fully unit-testable.
//
// Comparison rules per field type:
//   string : whitespace-collapsed, case-insensitive equality;
//            currency symbols (£, $, €) stripped before compare so a model
//            quirk like "£500,000" vs "500,000" doesn't count as wrong.
//   number : equal within 0.005 absolute tolerance.
//   array  : order-insensitive multiset equality, element-wise normalised
//            with the string rule.
//   null   : extracted must be null/undefined/empty-string.

import {
  CORRECTION_RATE_CEILING,
  DAY1_FIELDS,
  MIN_DOCS_FOR_CEILING_ENFORCEMENT,
  type CategoryReport,
  type Day1Category,
  type Day1Field,
  type DocResult,
  type FieldOutcome,
  type GroundTruth,
  type GroundTruthValue,
  type QualityReport,
} from './types';

const CURRENCY_RE = /[£$€]/g;

function normaliseString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(CURRENCY_RE, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function compareNumber(expected: number, extracted: unknown): boolean {
  if (typeof extracted !== 'number' || Number.isNaN(extracted)) return false;
  return Math.abs(expected - extracted) <= 0.005;
}

function compareArray(expected: readonly unknown[], extracted: unknown): boolean {
  if (!Array.isArray(extracted)) return false;
  if (expected.length !== extracted.length) return false;
  const expBag = expected.map(normaliseString).sort();
  const extBag = extracted.map(normaliseString).sort();
  for (let i = 0; i < expBag.length; i++) {
    if (expBag[i] !== extBag[i]) return false;
  }
  return true;
}

export function compareField(expected: GroundTruthValue, extracted: unknown): boolean {
  if (expected === null) return isEmpty(extracted);
  if (typeof expected === 'number') return compareNumber(expected, extracted);
  if (typeof expected === 'boolean') return expected === extracted;
  if (Array.isArray(expected)) return compareArray(expected, extracted);
  return normaliseString(expected) === normaliseString(extracted);
}

export function scoreDoc(
  ground: GroundTruth,
  parsed: Record<string, unknown> | null,
  meta: {
    model: string;
    promptVersion: string;
    latencyMs: number;
    costDeciPence: number | null;
    errorCode: string | null;
  }
): DocResult {
  const fieldOutcomes: Partial<Record<Day1Field, FieldOutcome>> = {};
  for (const field of DAY1_FIELDS) {
    if (!(field in ground.fields)) continue;
    const expected = ground.fields[field] as GroundTruthValue;
    const extracted = parsed?.[field];
    fieldOutcomes[field] = {
      expected,
      extracted: extracted ?? null,
      correct: parsed === null ? false : compareField(expected, extracted),
    };
  }
  return {
    docId: ground.docId,
    category: ground.category,
    model: meta.model,
    promptVersion: meta.promptVersion,
    latencyMs: meta.latencyMs,
    costDeciPence: meta.costDeciPence,
    errorCode: meta.errorCode,
    fieldOutcomes,
  };
}

function emptyCategoryRates() {
  const rates: Partial<Record<Day1Field, { scoredDocs: number; incorrectDocs: number }>> = {};
  return rates;
}

export function aggregateCategory(
  category: Day1Category,
  results: readonly DocResult[]
): CategoryReport {
  const inCategory = results.filter((r) => r.category === category);
  const tally = emptyCategoryRates();

  for (const result of inCategory) {
    for (const field of DAY1_FIELDS) {
      const outcome = result.fieldOutcomes[field];
      if (!outcome) continue;
      const cell = tally[field] ?? { scoredDocs: 0, incorrectDocs: 0 };
      cell.scoredDocs += 1;
      if (!outcome.correct) cell.incorrectDocs += 1;
      tally[field] = cell;
    }
  }

  const fields: CategoryReport['fields'] = {};
  let worstFieldRate = 0;
  let worstField: Day1Field | null = null;
  for (const field of DAY1_FIELDS) {
    const cell = tally[field];
    if (!cell) continue;
    const rate = cell.scoredDocs > 0 ? cell.incorrectDocs / cell.scoredDocs : 0;
    fields[field] = { ...cell, correctionRate: rate };
    if (rate > worstFieldRate) {
      worstFieldRate = rate;
      worstField = field;
    }
  }

  let enforcementSkippedReason: string | null = null;
  if (inCategory.length === 0) {
    enforcementSkippedReason = 'no docs in category';
  } else if (inCategory.length < MIN_DOCS_FOR_CEILING_ENFORCEMENT) {
    enforcementSkippedReason = `only ${inCategory.length} of ${MIN_DOCS_FOR_CEILING_ENFORCEMENT} docs scored — ceiling not enforced`;
  }
  const exceedsCeiling =
    enforcementSkippedReason === null && worstFieldRate > CORRECTION_RATE_CEILING;

  return {
    category,
    docCount: inCategory.length,
    fields,
    worstFieldRate,
    worstField,
    exceedsCeiling,
    enforcementSkippedReason,
  };
}

export function buildQualityReport(
  promptVersion: string,
  results: readonly DocResult[],
  categories: readonly Day1Category[]
): QualityReport {
  const cats = categories.map((c) => aggregateCategory(c, results));
  const failedCategories = cats.filter((c) => c.exceedsCeiling).map((c) => c.category);
  return {
    reportVersion: '1',
    manifestVersion: '1',
    promptVersion,
    totalDocs: results.length,
    categories: cats,
    failedCategories,
    ceiling: CORRECTION_RATE_CEILING,
    minDocsForEnforcement: MIN_DOCS_FOR_CEILING_ENFORCEMENT,
  };
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}
