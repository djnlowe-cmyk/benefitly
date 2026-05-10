import { buildExtractionPrompt, PARSE_PROMPT_VERSION } from './prompt';
import { costInDeciPence } from './pricing';
import type { ParsedDocument } from './types';

export const PARSE_DEFAULT_MODEL = 'claude-sonnet-4-20250514';
export const PARSE_DEFAULT_MAX_TOKENS = 2048;

export type ParseMimeType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

export interface ParseDocumentInput {
  buffer: Buffer;
  mimeType: ParseMimeType;
  country: string;
  currency: string;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  // Injected for tests + the bench harness's record/replay mode. Defaults to
  // global fetch.
  fetchImpl?: typeof fetch;
}

export interface ParseUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ParseDocumentResult {
  parsed: ParsedDocument | null;
  rawText: string | null;
  model: string;
  promptVersion: string;
  usage: ParseUsage | null;
  costDeciPence: number | null;
  latencyMs: number;
  error: string | null;
}

// Single source of truth for "call Claude, parse JSON out of the response".
// Used by the upload API route AND the bench harness so a CI path-filter on
// src/lib/ai/** catches every code change that can shift extraction quality.
export async function parseDocument(input: ParseDocumentInput): Promise<ParseDocumentResult> {
  const {
    buffer,
    mimeType,
    country,
    currency,
    apiKey,
    model = PARSE_DEFAULT_MODEL,
    maxTokens = PARSE_DEFAULT_MAX_TOKENS,
    fetchImpl = fetch,
  } = input;

  const base64 = buffer.toString('base64');
  const content: Array<Record<string, unknown>> = [];

  if (mimeType === 'application/pdf') {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    });
  } else {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    });
  }
  content.push({ type: 'text', text: buildExtractionPrompt(country, currency) });

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (err) {
    return {
      parsed: null,
      rawText: null,
      model,
      promptVersion: PARSE_PROMPT_VERSION,
      usage: null,
      costDeciPence: null,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  }
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    return {
      parsed: null,
      rawText: null,
      model,
      promptVersion: PARSE_PROMPT_VERSION,
      usage: null,
      costDeciPence: null,
      latencyMs,
      error: `http_${response.status}`,
    };
  }

  type AnthropicResponse = {
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const result = (await response.json()) as AnthropicResponse;
  const rawText = result.content?.[0]?.text ?? '';
  const usage: ParseUsage | null = result.usage
    ? {
        inputTokens: result.usage.input_tokens ?? 0,
        outputTokens: result.usage.output_tokens ?? 0,
      }
    : null;

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  let parsed: ParsedDocument | null = null;
  let parseError: string | null = null;
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]) as ParsedDocument;
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'json_parse_failed';
    }
  } else {
    parseError = 'no_json_in_response';
  }

  const costDeciPence = usage
    ? costInDeciPence(model, usage.inputTokens, usage.outputTokens)
    : null;

  return {
    parsed,
    rawText,
    model,
    promptVersion: PARSE_PROMPT_VERSION,
    usage,
    costDeciPence,
    latencyMs,
    error: parseError,
  };
}
