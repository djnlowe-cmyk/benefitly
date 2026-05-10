// Parse-quality benchmark CLI.
//
// Usage:
//   tsx bench/run.ts                       # fixture mode (CI smoke, offline)
//   tsx bench/run.ts --mode=live           # hit Claude with real PDFs
//   tsx bench/run.ts --baseline=path.json  # diff against this baseline
//   tsx bench/run.ts --update-baseline     # write current report as baseline
//
// Exit codes:
//   0 = all enforced categories within ceiling
//   1 = at least one Day-1 category exceeded the per-field ceiling
//   2 = harness error (manifest invalid, ground-truth missing, etc.)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  parseDocument,
  PARSE_DEFAULT_MODEL,
  PARSE_PROMPT_VERSION,
  type ParseMimeType,
} from '@/lib/ai';
import {
  DAY1_CATEGORIES,
  type CorpusManifest,
  type DocResult,
  type GroundTruth,
} from './types';
import { buildQualityReport, scoreDoc } from './scoring';
import { buildBenchReport, diffQuality, renderMarkdownSummary } from './report';
import { pickStorage } from './storage';

interface Args {
  mode: 'fixture' | 'live';
  manifestPath: string;
  groundTruthDir: string;
  fixturesDir: string;
  reportPath: string;
  summaryPath: string;
  baselinePath: string;
  updateBaseline: boolean;
  model: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const hit = args.find((a) => a.startsWith(`${flag}=`));
    return hit ? hit.slice(flag.length + 1) : fallback;
  };
  const has = (flag: string) => args.includes(flag);
  return {
    mode: (get('--mode', 'fixture') as Args['mode']),
    manifestPath: resolve(get('--manifest', 'bench/manifest.json')),
    groundTruthDir: resolve(get('--ground-truth-dir', 'bench/ground-truth')),
    fixturesDir: resolve(get('--fixtures-dir', 'bench/fixtures')),
    reportPath: resolve(get('--report', 'bench/reports/latest.json')),
    summaryPath: resolve(get('--summary', 'bench/reports/latest.md')),
    baselinePath: resolve(get('--baseline', 'bench/baselines/baseline.json')),
    updateBaseline: has('--update-baseline'),
    model: get('--model', PARSE_DEFAULT_MODEL),
  };
}

async function loadJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as T;
}

async function loadGroundTruth(dir: string, key: string): Promise<GroundTruth> {
  return await loadJson<GroundTruth>(resolve(dir, key));
}

interface ParseOutcome {
  parsed: Record<string, unknown> | null;
  model: string;
  promptVersion: string;
  latencyMs: number;
  costDeciPence: number | null;
  errorCode: string | null;
}

async function fixtureParse(fixturesDir: string, key: string): Promise<ParseOutcome> {
  // Fixture format: { parsed, latencyMs, costDeciPence, model, promptVersion, errorCode? }
  // Pre-recorded so the harness exercises end-to-end without a network call.
  const fx = await loadJson<{
    parsed: Record<string, unknown> | null;
    latencyMs?: number;
    costDeciPence?: number | null;
    model?: string;
    promptVersion?: string;
    errorCode?: string | null;
  }>(resolve(fixturesDir, key));
  return {
    parsed: fx.parsed,
    model: fx.model ?? 'fixture',
    promptVersion: fx.promptVersion ?? PARSE_PROMPT_VERSION,
    latencyMs: fx.latencyMs ?? 0,
    costDeciPence: fx.costDeciPence ?? 0,
    errorCode: fx.errorCode ?? null,
  };
}

async function liveParse(
  storage: ReturnType<typeof pickStorage>,
  category: string,
  storageKey: string,
  model: string,
  apiKey: string
): Promise<ParseOutcome> {
  const buffer = await storage.fetch(category, storageKey);
  const ext = storageKey.split('.').pop()?.toLowerCase();
  const mimeType: ParseMimeType =
    ext === 'pdf'
      ? 'application/pdf'
      : ext === 'png'
      ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
      ? 'image/webp'
      : ext === 'gif'
      ? 'image/gif'
      : 'application/pdf';

  const result = await parseDocument({
    buffer,
    mimeType,
    country: 'GB',
    currency: 'GBP',
    apiKey,
    model,
  });

  return {
    parsed: (result.parsed as Record<string, unknown> | null) ?? null,
    model: result.model,
    promptVersion: result.promptVersion,
    latencyMs: result.latencyMs,
    costDeciPence: result.costDeciPence,
    errorCode: result.error,
  };
}

async function main(): Promise<number> {
  const args = parseArgs();
  const manifest = await loadJson<CorpusManifest>(args.manifestPath);

  if (manifest.expectedPromptVersion !== PARSE_PROMPT_VERSION) {
    console.warn(
      `[bench] manifest expects prompt ${manifest.expectedPromptVersion}, codebase is ${PARSE_PROMPT_VERSION} — diffs vs baseline will be flagged as cross-version.`
    );
  }

  const liveApiKey = process.env.ANTHROPIC_API_KEY;
  if (args.mode === 'live' && (!liveApiKey || liveApiKey === 'your-api-key-here')) {
    console.error('[bench] --mode=live requires ANTHROPIC_API_KEY');
    return 2;
  }
  const storage = args.mode === 'live' ? pickStorage() : null;

  const docResults: DocResult[] = [];

  for (const entry of manifest.entries) {
    let outcome: ParseOutcome;
    try {
      outcome =
        entry.source === 'fixture'
          ? await fixtureParse(args.fixturesDir, entry.storageKey)
          : await liveParse(storage!, entry.category, entry.storageKey, args.model, liveApiKey!);
    } catch (err) {
      console.error(`[bench] ${entry.id} parse error:`, err instanceof Error ? err.message : err);
      outcome = {
        parsed: null,
        model: args.model,
        promptVersion: PARSE_PROMPT_VERSION,
        latencyMs: 0,
        costDeciPence: null,
        errorCode: err instanceof Error ? err.message : 'parse_error',
      };
    }

    let ground: GroundTruth;
    try {
      ground = await loadGroundTruth(args.groundTruthDir, entry.groundTruthKey);
    } catch (err) {
      console.error(
        `[bench] ${entry.id} ground-truth missing at ${entry.groundTruthKey}:`,
        err instanceof Error ? err.message : err
      );
      return 2;
    }

    if (ground.docId !== entry.id) {
      console.error(
        `[bench] ${entry.id} ground-truth docId mismatch (${ground.docId})`
      );
      return 2;
    }

    docResults.push(
      scoreDoc(ground, outcome.parsed, {
        model: outcome.model,
        promptVersion: outcome.promptVersion,
        latencyMs: outcome.latencyMs,
        costDeciPence: outcome.costDeciPence,
        errorCode: outcome.errorCode,
      })
    );
  }

  const quality = buildQualityReport(PARSE_PROMPT_VERSION, docResults, DAY1_CATEGORIES);
  const report = buildBenchReport(quality, docResults, new Date().toISOString());

  let previous: typeof quality | null = null;
  if (existsSync(args.baselinePath)) {
    previous = await loadJson<typeof quality>(args.baselinePath);
  }
  const diff = diffQuality(previous, quality);
  const summary = renderMarkdownSummary(report, diff);

  await mkdir(dirname(args.reportPath), { recursive: true });
  await writeFile(args.reportPath, JSON.stringify(report, null, 2) + '\n');
  await mkdir(dirname(args.summaryPath), { recursive: true });
  await writeFile(args.summaryPath, summary);

  if (args.updateBaseline) {
    await mkdir(dirname(args.baselinePath), { recursive: true });
    await writeFile(args.baselinePath, JSON.stringify(quality, null, 2) + '\n');
    console.log(`[bench] baseline updated -> ${args.baselinePath}`);
  }

  console.log(summary);

  if (quality.failedCategories.length > 0) {
    console.error(
      `[bench] FAIL — categories over ${(quality.ceiling * 100).toFixed(0)}%: ${quality.failedCategories.join(', ')}`
    );
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('[bench] harness crashed:', err);
    process.exit(2);
  }
);
