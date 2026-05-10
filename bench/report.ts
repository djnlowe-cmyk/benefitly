// Report assembly + diff vs prior baseline. Pure given inputs.

import { formatDeciPence } from '@/lib/ai';
import {
  DAY1_FIELDS,
  type BenchReport,
  type Day1Field,
  type DocResult,
  type LatencyStats,
  type QualityReport,
} from './types';
import { percentile } from './scoring';

export function buildBenchReport(
  quality: QualityReport,
  results: readonly DocResult[],
  generatedAt: string
): BenchReport {
  const modelDistribution: Record<string, number> = {};
  let totalCost = 0;
  let costsKnown = 0;
  const unknownPricing = new Set<string>();
  const latencies: number[] = [];

  for (const r of results) {
    modelDistribution[r.model] = (modelDistribution[r.model] ?? 0) + 1;
    if (r.costDeciPence === null) {
      unknownPricing.add(r.model);
    } else {
      totalCost += r.costDeciPence;
      costsKnown += 1;
    }
    latencies.push(r.latencyMs);
  }

  const sortedLat = [...latencies].sort((a, b) => a - b);
  const latencyMs: LatencyStats = {
    p50: percentile(sortedLat, 0.5),
    p95: percentile(sortedLat, 0.95),
    max: sortedLat[sortedLat.length - 1] ?? 0,
  };

  const costPerDocDeciPence = costsKnown > 0 ? Math.round(totalCost / costsKnown) : null;

  return {
    ...quality,
    generatedAt,
    modelDistribution,
    totalCostDeciPence: totalCost,
    costPerDocDeciPence,
    latencyMs,
    unknownPricingModels: [...unknownPricing].sort(),
  };
}

// Equality on the deterministic part — used in tests + by the diff to detect
// whether quality changed at all between two runs.
export function qualityKey(report: QualityReport): string {
  return JSON.stringify(report);
}

export interface QualityDiff {
  promptVersionChanged: boolean;
  totalDocsDelta: number;
  newlyFailedCategories: string[];
  newlyPassingCategories: string[];
  fieldDeltas: Array<{
    category: string;
    field: Day1Field;
    previous: number;
    current: number;
    delta: number;
  }>;
}

export function diffQuality(
  previous: QualityReport | null,
  current: QualityReport
): QualityDiff {
  if (previous === null) {
    return {
      promptVersionChanged: false,
      totalDocsDelta: current.totalDocs,
      newlyFailedCategories: [...current.failedCategories],
      newlyPassingCategories: [],
      fieldDeltas: [],
    };
  }
  const prevByCategory = new Map(previous.categories.map((c) => [c.category, c]));
  const currByCategory = new Map(current.categories.map((c) => [c.category, c]));
  const prevFailed = new Set(previous.failedCategories);
  const currFailed = new Set(current.failedCategories);

  const newlyFailedCategories = [...currFailed].filter((c) => !prevFailed.has(c)).sort();
  const newlyPassingCategories = [...prevFailed].filter((c) => !currFailed.has(c)).sort();

  const fieldDeltas: QualityDiff['fieldDeltas'] = [];
  for (const [category, currCat] of currByCategory) {
    const prevCat = prevByCategory.get(category);
    if (!prevCat) continue;
    for (const field of DAY1_FIELDS) {
      const prevRate = prevCat.fields[field]?.correctionRate;
      const currRate = currCat.fields[field]?.correctionRate;
      if (prevRate === undefined || currRate === undefined) continue;
      const delta = currRate - prevRate;
      if (Math.abs(delta) > 0.001) {
        fieldDeltas.push({ category, field, previous: prevRate, current: currRate, delta });
      }
    }
  }
  fieldDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    promptVersionChanged: previous.promptVersion !== current.promptVersion,
    totalDocsDelta: current.totalDocs - previous.totalDocs,
    newlyFailedCategories,
    newlyPassingCategories,
    fieldDeltas,
  };
}

export function renderMarkdownSummary(report: BenchReport, diff: QualityDiff | null): string {
  const lines: string[] = [];
  lines.push(`# Parse-quality benchmark`);
  lines.push('');
  lines.push(`- prompt: \`${report.promptVersion}\``);
  lines.push(`- docs scored: ${report.totalDocs}`);
  lines.push(`- ceiling: ${(report.ceiling * 100).toFixed(0)}% per field per category`);
  lines.push(`- total cost: ${formatDeciPence(report.totalCostDeciPence)}` +
    (report.costPerDocDeciPence !== null
      ? ` (${formatDeciPence(report.costPerDocDeciPence)} / doc)`
      : ''));
  lines.push(`- latency: p50 ${report.latencyMs.p50}ms · p95 ${report.latencyMs.p95}ms`);
  if (report.unknownPricingModels.length > 0) {
    lines.push(`- ⚠ unknown pricing for: ${report.unknownPricingModels.join(', ')}`);
  }
  lines.push('');

  if (diff?.promptVersionChanged) {
    lines.push(`> prompt version changed since last baseline — apples-to-oranges`);
    lines.push('');
  }

  lines.push(`## By category`);
  lines.push('');
  lines.push('| category | docs | worst field | rate | ceiling |');
  lines.push('|---|---|---|---|---|');
  for (const c of report.categories) {
    const worst = c.worstField ? `\`${c.worstField}\`` : '—';
    const rate = `${(c.worstFieldRate * 100).toFixed(1)}%`;
    let status = '✓';
    if (c.exceedsCeiling) status = '✗ FAIL';
    else if (c.enforcementSkippedReason) status = `– (${c.enforcementSkippedReason})`;
    lines.push(`| ${c.category} | ${c.docCount} | ${worst} | ${rate} | ${status} |`);
  }

  if (report.failedCategories.length > 0) {
    lines.push('');
    lines.push(`## ✗ Failing categories`);
    for (const cat of report.failedCategories) {
      lines.push(`- \`${cat}\``);
    }
  }

  if (diff && (diff.newlyFailedCategories.length > 0 || diff.newlyPassingCategories.length > 0 || diff.fieldDeltas.length > 0)) {
    lines.push('');
    lines.push(`## Diff vs baseline`);
    if (diff.newlyFailedCategories.length > 0) {
      lines.push(`- newly failing: ${diff.newlyFailedCategories.join(', ')}`);
    }
    if (diff.newlyPassingCategories.length > 0) {
      lines.push(`- newly passing: ${diff.newlyPassingCategories.join(', ')}`);
    }
    if (diff.fieldDeltas.length > 0) {
      lines.push('');
      lines.push('| category | field | prev | now | Δ |');
      lines.push('|---|---|---|---|---|');
      for (const d of diff.fieldDeltas.slice(0, 15)) {
        const sign = d.delta > 0 ? '+' : '';
        lines.push(
          `| ${d.category} | \`${d.field}\` | ${(d.previous * 100).toFixed(1)}% | ${(d.current * 100).toFixed(1)}% | ${sign}${(d.delta * 100).toFixed(1)}% |`
        );
      }
    }
  }

  return lines.join('\n') + '\n';
}
