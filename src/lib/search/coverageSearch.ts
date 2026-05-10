// Boundary function for coverage search. The route handler stays thin and
// delegates the Claude call + JSON shape validation to this module so we can
// later swap in embeddings / a different vendor without touching the route or
// the UI. Inputs: pre-loaded coverages JSON, free-text query, region. Outputs:
// validated SearchHit[] (cited fields/excerpts that must literally appear in
// the source coverage) plus an optional GapAnswer when nothing matches.

export interface SearchCoveragePromptRow {
  id: string;
  provider: string;
  type: string;
  category: string;
  policyNo: string | null;
  summary: string | null;
  coverageLimit: string | null;
  coInsurance: string | null;
  covered: unknown;
  exclusions: unknown;
}

export interface SearchHit {
  coverageId: string;
  relevance: 'high' | 'medium' | 'low';
  citedField: string;
  citedExcerpt: string;
  explanation: string;
  coordination?: string;
}

export interface GapAnswer {
  explanation: string;
  recommendedTypes: string[];
}

// Anthropic /v1/messages usage block. Mirrors the shape we persist via
// claudeUsage.recordClaudeCall — kept loose because the API occasionally
// adds new fields and we don't want to drop unknown ones.
export interface ClaudeUsageBlock {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface SearchCoveragesResult {
  results: SearchHit[];
  gapAnswer?: GapAnswer;
  // Present when the upstream call returned 2xx. Absent on network/HTTP
  // failure so callers can distinguish "model returned 0 hits" from
  // "request never landed". Lets the route record cost only on real calls.
  usage?: ClaudeUsageBlock;
  model?: string;
}

export interface SearchCoveragesArgs {
  coverages: SearchCoveragePromptRow[];
  query: string;
  region: { country: string; currency: string };
  apiKey: string;
  // Hook for tests; defaults to global fetch.
  fetchImpl?: typeof fetch;
  // Hook for tests; defaults to 25_000ms per the issue spec.
  timeoutMs?: number;
}

const VALID_RELEVANCE = new Set<SearchHit['relevance']>(['high', 'medium', 'low']);

const FALLBACK_GAP: GapAnswer = {
  explanation: "I couldn't read that one — try the concierge link below.",
  recommendedTypes: [],
};

function buildPrompt(
  coverages: SearchCoveragePromptRow[],
  query: string,
  region: { country: string; currency: string },
): string {
  const isUK = region.country === 'GB';
  const regionGuidance = isUK
    ? [
        'The user is in the UK. Use UK insurance vocabulary:',
        '- "excess" rather than "deductible"',
        '- "buildings & contents" rather than "homeowner\'s"',
        '- "private medical" rather than "PPO"',
        '- Health cover sits alongside the NHS — coordinate with it where relevant',
        '- For credit-card purchase protection, mention Section 75 (£100–£30,000) and chargeback rights when relevant',
        '- Money is GBP unless stated otherwise',
      ].join('\n')
    : `The user is in ${region.country} and uses ${region.currency}. Use local conventions where possible.`;

  return [
    'You are a coverage-search engine for a personal insurance app.',
    'Given the user\'s coverages JSON below and a free-text question, return the matches most likely to apply.',
    '',
    regionGuidance,
    '',
    'Rules:',
    '- Use ONLY the coverages provided. Never invent coverageIds, provider names, or excerpts.',
    '- citedExcerpt MUST be a verbatim substring of the cited field on the coverage you are citing. Do NOT paraphrase or fabricate.',
    '- citedField is the JSON path of the cited field, e.g. "covered", "exclusions[2]", "summary", "coverageLimit". Use array indices for list items.',
    '- relevance is one of "high", "medium", "low".',
    '- explanation: 1–2 sentences, plain language, addressed to the user.',
    '- coordination: optional, one sentence on what the user should do next (call provider, file claim, escalate).',
    '- Sort matches by relevance high → low. An empty list is a valid answer.',
    '- If nothing in the coverages applies, return results: [] AND a gapAnswer that names the cover types the user would typically need.',
    '',
    `Question: ${query}`,
    '',
    'Coverages:',
    JSON.stringify(coverages),
    '',
    'Reply with JSON only, no prose, in this exact shape:',
    '{ "results": [ { "coverageId": "<id from input>", "relevance": "high"|"medium"|"low", "citedField": "<field path>", "citedExcerpt": "<verbatim substring>", "explanation": "...", "coordination": "..." } ], "gapAnswer": { "explanation": "...", "recommendedTypes": ["..."] } }',
    'Omit gapAnswer when results is non-empty.',
  ].join('\n');
}

function parseJsonBlock(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function validateHit(
  raw: unknown,
  coverageMap: Map<string, string>,
): SearchHit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const coverageId = pickString(r.coverageId);
  if (!coverageId) return null;
  const sourceJson = coverageMap.get(coverageId);
  if (!sourceJson) return null; // hallucinated id, or another user's coverage
  const citedField = pickString(r.citedField);
  const citedExcerpt = pickString(r.citedExcerpt);
  const explanation = pickString(r.explanation);
  if (!citedField || !citedExcerpt || !explanation) return null;
  // Defensive: drop hits whose cited excerpt is fabricated. We compare against
  // the JSON-stringified coverage so escapes line up; a literal substring match
  // is enough to catch the common hallucination shape (whole sentences the
  // model invented). This protects against AI failure modes per CTO guidance.
  if (!sourceJson.includes(citedExcerpt)) return null;
  const relevance: SearchHit['relevance'] = VALID_RELEVANCE.has(
    r.relevance as SearchHit['relevance'],
  )
    ? (r.relevance as SearchHit['relevance'])
    : 'medium';
  const coordination = pickString(r.coordination);
  return {
    coverageId,
    relevance,
    citedField,
    citedExcerpt,
    explanation,
    ...(coordination ? { coordination } : {}),
  };
}

function validateGap(raw: unknown): GapAnswer | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const explanation = pickString(r.explanation);
  if (!explanation) return undefined;
  const recommendedTypes = Array.isArray(r.recommendedTypes)
    ? r.recommendedTypes.filter((t): t is string => typeof t === 'string')
    : [];
  return { explanation, recommendedTypes };
}

export const COVERAGE_SEARCH_MODEL = 'claude-sonnet-4-20250514';

export async function searchCoverages(
  args: SearchCoveragesArgs,
): Promise<SearchCoveragesResult> {
  const { coverages, query, region, apiKey } = args;
  const fetchImpl = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? 25_000;

  // Build a map of coverageId → its full JSON source string. The substring
  // check below uses this to prove the model isn't fabricating excerpts.
  const coverageMap = new Map<string, string>();
  for (const c of coverages) {
    coverageMap.set(c.id, JSON.stringify(c));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: COVERAGE_SEARCH_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: buildPrompt(coverages, query, region) }],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[searchCoverages] upstream fetch failed', { name: (err as Error)?.name });
    return { results: [], gapAnswer: FALLBACK_GAP };
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    console.error('[searchCoverages] upstream non-2xx', { status: upstream.status });
    return { results: [], gapAnswer: FALLBACK_GAP };
  }

  let body: { content?: { text?: string }[]; usage?: ClaudeUsageBlock };
  try {
    body = (await upstream.json()) as {
      content?: { text?: string }[];
      usage?: ClaudeUsageBlock;
    };
  } catch {
    console.error('[searchCoverages] upstream JSON unreadable');
    return { results: [], gapAnswer: FALLBACK_GAP };
  }

  const usage = body.usage;
  const model = COVERAGE_SEARCH_MODEL;

  const text = body.content?.[0]?.text ?? '';
  const parsed = parseJsonBlock(text);
  if (!parsed || typeof parsed !== 'object') {
    console.error('[searchCoverages] upstream content not parseable');
    return { results: [], gapAnswer: FALLBACK_GAP, usage, model };
  }

  const obj = parsed as Record<string, unknown>;
  const rawResults = Array.isArray(obj.results) ? obj.results : [];
  const results: SearchHit[] = [];
  for (const raw of rawResults) {
    const hit = validateHit(raw, coverageMap);
    if (hit) results.push(hit);
  }

  if (results.length > 0) {
    return { results, usage, model };
  }

  // Empty results → expose the gapAnswer if the model produced one,
  // otherwise return an empty results list with no gap (caller decides).
  const gap = validateGap(obj.gapAnswer);
  return gap ? { results, gapAnswer: gap, usage, model } : { results, usage, model };
}
