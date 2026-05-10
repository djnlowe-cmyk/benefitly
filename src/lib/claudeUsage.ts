import prisma from './db';

// Per-Claude-call cost recording. Drives the AI cost & quality dashboard
// (per-doc + per-user £-spend, weekly digest, £1.10 trip-wire). Inputs are
// the model name + Anthropic /v1/messages `usage` block (token counts).
// We deliberately persist NO prompt or response text — only token counts,
// model id, task tag, and the £-cost — per security-compliance §2.

export type ClaudeTask = 'parse' | 'search-rerank' | 're-extract';

// Anthropic published prices in USD per 1M tokens. Refresh path: bump the
// table below when Anthropic publishes new pricing, log the source URL +
// effective date in the commit message, and bump CLAUDE_PRICING_VERSION
// so the dashboard can flag a price-change boundary if needed.
//
// Source: https://www.anthropic.com/pricing (snapshot 2026-05-10).
// Cache-write 5min ($3.75) and 1h ($6.00) are not separately distinguished
// by the API response — we conservatively price all cache_creation_input
// at the 5-min tier; if we later move to 1h caching, bump this constant.
export const CLAUDE_PRICING_VERSION = '2026-05';

interface ModelPricingUsd {
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M: number;
  cacheWritePer1M: number;
}

const PRICING_USD: Record<string, ModelPricingUsd> = {
  'claude-sonnet-4-20250514': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    cacheReadPer1M: 0.3,
    cacheWritePer1M: 3.75,
  },
  'claude-opus-4-20250514': {
    inputPer1M: 15.0,
    outputPer1M: 75.0,
    cacheReadPer1M: 1.5,
    cacheWritePer1M: 18.75,
  },
  'claude-haiku-4-5-20251001': {
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    cacheReadPer1M: 0.1,
    cacheWritePer1M: 1.25,
  },
};

// Sterling rate fallback. Refresh path: ops can override at deploy time
// via USD_GBP_RATE without a code change. The blended rate is intentionally
// not pulled from a live FX feed in v1 — that's a separate ticket.
// Source: roughly the Bank of England 2026-Q1 average; bump quarterly.
const DEFAULT_USD_GBP_RATE = 0.79;

export function usdToGbpRate(): number {
  const raw = process.env.USD_GBP_RATE;
  if (!raw) return DEFAULT_USD_GBP_RATE;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_USD_GBP_RATE;
  return parsed;
}

// Anthropic /v1/messages usage block — the fields we care about. We keep
// this loosely typed because Anthropic occasionally adds new fields and we
// don't want to fail-fail on an unexpected key.
export interface ClaudeUsageBlock {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ComputedCost {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costPence: number;
}

function safeInt(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

export function computeCost(
  model: string,
  usage: ClaudeUsageBlock | undefined | null,
): ComputedCost {
  const inputTokens = safeInt(usage?.input_tokens);
  const outputTokens = safeInt(usage?.output_tokens);
  const cacheReadTokens = safeInt(usage?.cache_read_input_tokens);
  const cacheCreationTokens = safeInt(usage?.cache_creation_input_tokens);

  const pricing = PRICING_USD[model];
  if (!pricing) {
    // Unknown model — record the tokens but cost £0. Surfaced on the
    // dashboard as a 0-cost row tagged with the unknown model id so the
    // operator notices and updates PRICING_USD.
    return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costPence: 0 };
  }

  const usdPerToken =
    (inputTokens * pricing.inputPer1M
      + outputTokens * pricing.outputPer1M
      + cacheReadTokens * pricing.cacheReadPer1M
      + cacheCreationTokens * pricing.cacheWritePer1M)
    / 1_000_000;

  const gbp = usdPerToken * usdToGbpRate();
  // Pence, rounded to nearest. Stored as Int to mirror SearchEvent.costPence.
  const costPence = Math.max(0, Math.round(gbp * 100));

  return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costPence };
}

export interface RecordClaudeCallArgs {
  userId: string;
  documentId?: string | null;
  task: ClaudeTask;
  model: string;
  usage: ClaudeUsageBlock | undefined | null;
  successful?: boolean;
}

// Fire-and-forget. A write failure here MUST NOT fail the upload/search
// request — costs are observability data, not a hard dependency on the
// hot path. Mirrors the SearchEvent insert pattern in /api/search.
export function recordClaudeCall(args: RecordClaudeCallArgs): void {
  const cost = computeCost(args.model, args.usage);
  prisma.claudeUsage
    .create({
      data: {
        userId: args.userId,
        documentId: args.documentId ?? null,
        task: args.task,
        model: args.model,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        cacheReadTokens: cost.cacheReadTokens,
        cacheCreationTokens: cost.cacheCreationTokens,
        costPence: cost.costPence,
        successful: args.successful ?? true,
      },
    })
    .catch((err) => console.error('claudeUsage insert failed', err));
}

// Awaitable variant for tests that need to assert the row exists before
// returning. Production code paths should prefer `recordClaudeCall`.
export async function recordClaudeCallAwait(args: RecordClaudeCallArgs): Promise<void> {
  const cost = computeCost(args.model, args.usage);
  try {
    await prisma.claudeUsage.create({
      data: {
        userId: args.userId,
        documentId: args.documentId ?? null,
        task: args.task,
        model: args.model,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        cacheReadTokens: cost.cacheReadTokens,
        cacheCreationTokens: cost.cacheCreationTokens,
        costPence: cost.costPence,
        successful: args.successful ?? true,
      },
    });
  } catch (err) {
    console.error('claudeUsage insert failed', err);
  }
}
