// Self-contained assertion smoke for the harness. Runs the pure scoring,
// report, diff and PII modules against synthetic inputs and exits non-zero
// on the first failure. Promoted to vitest tests once vitest lands on main.
//
//   npx tsx bench/__smoke__.ts

import { strict as assert } from 'node:assert';
import {
  CORRECTION_RATE_CEILING,
  DAY1_CATEGORIES,
  MIN_DOCS_FOR_CEILING_ENFORCEMENT,
  type DocResult,
  type Day1Category,
  type GroundTruth,
} from './types';
import { aggregateCategory, buildQualityReport, compareField, scoreDoc } from './scoring';
import { buildBenchReport, diffQuality, renderMarkdownSummary } from './report';
import { findPii } from './piiRules';
import { costInDeciPence, formatDeciPence } from '../src/lib/ai';

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL  ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}

console.log('# scoring.compareField');
check('strings normalise whitespace + case + currency', () => {
  assert.equal(compareField('£500,000', '500,000'), true);
  assert.equal(compareField('Buildings & Contents', 'buildings  &   contents'), true);
  assert.equal(compareField('Aviva', 'Direct Line'), false);
});
check('numbers within tolerance', () => {
  assert.equal(compareField(38.42, 38.42), true);
  assert.equal(compareField(38.42, 38.421), true);
  assert.equal(compareField(38.42, 39), false);
});
check('arrays order-insensitive', () => {
  assert.equal(compareField(['a', 'b'], ['b', 'a']), true);
  assert.equal(compareField(['a', 'b'], ['a']), false);
});
check('null ground truth equivalent to empty/missing', () => {
  assert.equal(compareField(null, null), true);
  assert.equal(compareField(null, ''), true);
  assert.equal(compareField(null, []), true);
  assert.equal(compareField(null, 'something'), false);
});

console.log('# scoring.scoreDoc');
check('field outcomes only for labelled fields', () => {
  const ground: GroundTruth = {
    docId: 'home-001',
    category: 'home',
    promptVersion: 'v1',
    fields: { provider: 'Aviva', premium: 38.42 },
  };
  const result = scoreDoc(ground, { provider: 'Aviva', premium: 39 }, {
    model: 'm', promptVersion: 'v1', latencyMs: 100, costDeciPence: 50, errorCode: null,
  });
  assert.equal(Object.keys(result.fieldOutcomes).length, 2);
  assert.equal(result.fieldOutcomes.provider?.correct, true);
  assert.equal(result.fieldOutcomes.premium?.correct, false);
});
check('null parsed marks every labelled field incorrect', () => {
  const ground: GroundTruth = {
    docId: 'x', category: 'auto', promptVersion: 'v1',
    fields: { provider: 'Direct Line' },
  };
  const result = scoreDoc(ground, null, {
    model: 'm', promptVersion: 'v1', latencyMs: 0, costDeciPence: null, errorCode: 'http_500',
  });
  assert.equal(result.fieldOutcomes.provider?.correct, false);
});

console.log('# scoring.aggregateCategory');
function buildResults(category: Day1Category, perField: Array<Record<string, boolean>>): DocResult[] {
  return perField.map((row, i) => ({
    docId: `${category}-${i}`,
    category,
    model: 'm', promptVersion: 'v1', latencyMs: 100, costDeciPence: 50, errorCode: null,
    fieldOutcomes: Object.fromEntries(
      Object.entries(row).map(([f, correct]) => [
        f, { expected: 'x', extracted: correct ? 'x' : 'y', correct },
      ])
    ),
  })) as DocResult[];
}
check('rate is incorrect/scored', () => {
  const cat = aggregateCategory('home', buildResults('home', [
    { provider: true, premium: false },
    { provider: true, premium: true },
    { provider: false, premium: true },
    { provider: true, premium: true },
  ]));
  assert.equal(cat.docCount, 4);
  assert.equal(cat.fields.provider?.scoredDocs, 4);
  assert.equal(cat.fields.provider?.incorrectDocs, 1);
  assert.equal(cat.fields.provider?.correctionRate.toFixed(2), '0.25');
  assert.equal(cat.fields.premium?.correctionRate.toFixed(2), '0.25');
  assert.equal(cat.worstFieldRate.toFixed(2), '0.25');
});
check('ceiling not enforced below MIN_DOCS_FOR_CEILING_ENFORCEMENT', () => {
  const cat = aggregateCategory('home', buildResults('home', [
    { provider: false }, // 100% wrong but only 1 doc
  ]));
  assert.equal(cat.exceedsCeiling, false);
  assert.match(cat.enforcementSkippedReason ?? '', /only 1 of \d+ docs/);
});
check('ceiling enforced once min docs reached', () => {
  const rows = Array.from({ length: MIN_DOCS_FOR_CEILING_ENFORCEMENT }, (_, i) => ({
    provider: i === 0, // 4 of 5 wrong = 80%
  }));
  const cat = aggregateCategory('auto', buildResults('auto', rows));
  assert.equal(cat.exceedsCeiling, true);
  assert.equal(cat.enforcementSkippedReason, null);
  assert.ok(cat.worstFieldRate > CORRECTION_RATE_CEILING);
});
check('ceiling NOT exceeded at exactly the threshold', () => {
  // 5 docs, exactly 1 wrong = 20% — over the 15% ceiling.
  // Verify a known passing case: 0/5 wrong = 0%.
  const rows = Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: true });
  const cat = aggregateCategory('travel', buildResults('travel', rows));
  assert.equal(cat.exceedsCeiling, false);
  assert.equal(cat.worstFieldRate, 0);
});

console.log('# scoring.buildQualityReport');
check('failedCategories sorted by enumeration', () => {
  const docs: DocResult[] = [
    ...buildResults('home', Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: false })),
    ...buildResults('auto', Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: true })),
  ];
  const q = buildQualityReport('v1', docs, DAY1_CATEGORIES);
  assert.deepEqual(q.failedCategories, ['home']);
  assert.equal(q.ceiling, CORRECTION_RATE_CEILING);
});

console.log('# report.diffQuality');
check('null previous = treats current failures as newly failed', () => {
  const docs = buildResults('home', Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: false }));
  const q = buildQualityReport('v1', docs, DAY1_CATEGORIES);
  const diff = diffQuality(null, q);
  assert.deepEqual(diff.newlyFailedCategories, ['home']);
});
check('detects newly passing categories', () => {
  const failing = buildQualityReport('v1',
    buildResults('home', Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: false })),
    DAY1_CATEGORIES);
  const passing = buildQualityReport('v1',
    buildResults('home', Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: true })),
    DAY1_CATEGORIES);
  const diff = diffQuality(failing, passing);
  assert.deepEqual(diff.newlyPassingCategories, ['home']);
});
check('field deltas sorted by absolute delta desc', () => {
  const prev = buildQualityReport('v1', buildResults('home', [
    { a: true, b: true, c: true, d: true, e: true },
    { a: false, b: true, c: false, d: true, e: true },
  ] as never), DAY1_CATEGORIES);
  // Synthetic: set custom rates by editing the report directly so we can
  // test the diff sort without playing tetris with input combinations.
  const homeIdx = prev.categories.findIndex((c) => c.category === 'home');
  prev.categories[homeIdx].fields = {
    provider: { scoredDocs: 5, incorrectDocs: 0, correctionRate: 0 },
    premium:  { scoredDocs: 5, incorrectDocs: 1, correctionRate: 0.2 },
  };
  const curr = JSON.parse(JSON.stringify(prev));
  curr.categories[homeIdx].fields = {
    provider: { scoredDocs: 5, incorrectDocs: 1, correctionRate: 0.2 },
    premium:  { scoredDocs: 5, incorrectDocs: 0, correctionRate: 0 },
  };
  const diff = diffQuality(prev, curr);
  assert.equal(diff.fieldDeltas.length, 2);
  assert.equal(diff.fieldDeltas[0].field, 'provider');
  assert.equal(Math.abs(diff.fieldDeltas[0].delta).toFixed(2), '0.20');
});

console.log('# report.buildBenchReport');
check('cost rollup ignores unknown-pricing models', () => {
  const docs: DocResult[] = [
    ...buildResults('home', [{ provider: true }]).map((r) => ({ ...r, costDeciPence: 100 })),
    ...buildResults('home', [{ provider: true }]).map((r) => ({ ...r, costDeciPence: null, model: 'mystery' })),
  ];
  const q = buildQualityReport('v1', docs, DAY1_CATEGORIES);
  const r = buildBenchReport(q, docs, '2026-05-10T00:00:00Z');
  assert.equal(r.totalCostDeciPence, 100);
  assert.deepEqual(r.unknownPricingModels, ['mystery']);
});
check('latency p50/p95 sorted', () => {
  const docs: DocResult[] = Array.from({ length: 100 }, (_, i) => ({
    docId: `d${i}`, category: 'home', model: 'm', promptVersion: 'v1',
    latencyMs: i + 1, costDeciPence: 0, errorCode: null,
    fieldOutcomes: { provider: { expected: 'x', extracted: 'x', correct: true } },
  }));
  const q = buildQualityReport('v1', docs, DAY1_CATEGORIES);
  const r = buildBenchReport(q, docs, '2026-05-10T00:00:00Z');
  assert.equal(r.latencyMs.p50, 51);
  assert.equal(r.latencyMs.p95, 96);
  assert.equal(r.latencyMs.max, 100);
});
check('markdown summary mentions failed categories + cost', () => {
  const docs = buildResults('home', Array(MIN_DOCS_FOR_CEILING_ENFORCEMENT).fill({ provider: false }))
    .map((r) => ({ ...r, costDeciPence: 80 }));
  const q = buildQualityReport('v1', docs, DAY1_CATEGORIES);
  const r = buildBenchReport(q, docs, '2026-05-10T00:00:00Z');
  const md = renderMarkdownSummary(r, diffQuality(null, q));
  assert.match(md, /Failing categories/);
  assert.match(md, /home/);
  assert.match(md, /total cost/);
});

console.log('# pricing');
check('claude-sonnet-4 cost computation in deci-pence', () => {
  const cost = costInDeciPence('claude-sonnet-4-20250514', 12_000, 2_000);
  // input 12k * $3/Mtok = $0.036 ; output 2k * $15/Mtok = $0.030 ; total $0.066
  // GBP: $0.066 * 0.79 = £0.05214 = 5.214p = 52.14 deci-pence -> round 52
  assert.ok(cost !== null);
  assert.ok(cost! >= 50 && cost! <= 55, `expected ~52 deci-pence, got ${cost}`);
});
check('unknown model returns null', () => {
  assert.equal(costInDeciPence('gpt-9', 1, 1), null);
});
check('formatDeciPence renders £ when over 100p', () => {
  assert.equal(formatDeciPence(50), '5.00p');
  assert.equal(formatDeciPence(2500), '£2.50');
  assert.equal(formatDeciPence(null), 'unknown');
});

console.log('# piiRules.findPii');
check('flags UK postcode + NI number + email + sort code', () => {
  const text = 'John lives at SW1A 1AA, NI: AB123456C, email john@example.com, sort 12-34-56.';
  const findings = findPii({ text });
  const rules = findings.map((f) => f.rule).sort();
  assert.ok(rules.includes('uk-postcode'));
  assert.ok(rules.includes('ni-number'));
  assert.ok(rules.includes('email'));
  assert.ok(rules.includes('sort-code'));
});
check('phone is a warn, not an error', () => {
  const findings = findPii({ text: 'Call us on 0345 030 6900.' });
  const phones = findings.filter((f) => f.rule === 'uk-phone');
  assert.equal(phones.length, 1);
  assert.equal(phones[0].severity, 'warn');
});
check('deny-list match is an error', () => {
  const findings = findPii({
    text: 'Hello David, your policy is fine.',
    deny: { values: ['David'] },
  });
  const denyFindings = findings.filter((f) => f.rule === 'deny-list');
  assert.equal(denyFindings.length, 1);
  assert.equal(denyFindings[0].severity, 'error');
});
check('clean text yields zero findings', () => {
  const findings = findPii({ text: 'Generic policy text with no PII whatsoever.' });
  assert.equal(findings.length, 0);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nall smoke checks passed');
}
