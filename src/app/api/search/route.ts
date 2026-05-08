import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';

type Relevance = 'high' | 'medium' | 'low';
type CitedField =
  | 'covered'
  | 'exclusions'
  | 'summary'
  | 'type'
  | 'coverageLimit'
  | 'coInsurance';

interface ClaudeMatch {
  coverageId: string;
  relevance: Relevance;
  citedField: CitedField;
  citedValue: string;
  explanation: string;
  coordination: string;
}

interface EnrichedMatch extends ClaudeMatch {
  provider: string;
  type: string;
  sourceDocumentId: string | null;
}

const VALID_RELEVANCE = new Set<Relevance>(['high', 'medium', 'low']);
const VALID_CITED_FIELDS = new Set<CitedField>([
  'covered',
  'exclusions',
  'summary',
  'type',
  'coverageLimit',
  'coInsurance',
]);

function buildPrompt(coverages: unknown[], query: string): string {
  return [
    'You are a coverage-search engine for a personal-insurance app.',
    'Given the user\'s coverage rows and a free-text situation, return the matches most likely to apply.',
    '',
    'Rules:',
    '- Use ONLY the coverages provided. Do not invent coverageIds, provider names, or citedValues.',
    '- citedValue MUST be an exact substring from the cited field on the coverage you are citing.',
    '- Pick at most one citedField per match (the strongest evidence).',
    '- Sort matches by relevance (high → low). Empty list is a valid answer.',
    '- explanation: one sentence, plain English.',
    '- coordination: one sentence — what the user should do next (call, file, escalate).',
    '',
    `Query: ${query}`,
    '',
    'Coverages:',
    JSON.stringify(coverages),
    '',
    'Reply with JSON only, no prose, in this exact shape:',
    '{ "matches": [ { "coverageId": "<uuid from input>", "relevance": "high"|"medium"|"low", "citedField": "covered"|"exclusions"|"summary"|"type"|"coverageLimit"|"coInsurance", "citedValue": "...", "explanation": "...", "coordination": "..." } ] }',
  ].join('\n');
}

function parseJsonReply(text: string): { matches: unknown[] } | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed && Array.isArray(parsed.matches)) {
      return { matches: parsed.matches };
    }
    return { matches: [] };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const rawQuery = (body as { query?: unknown } | null)?.query;
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const coverages = await prisma.coverage.findMany({
    where: { userId: session.userId },
  });

  const coverageMap = new Map<
    string,
    { provider: string; type: string; sourceDocumentId: string | null }
  >();
  const promptCoverages = coverages.map((c) => {
    const parsed = {
      id: c.id,
      provider: c.provider,
      type: c.type,
      category: c.category,
      summary: c.summary,
      coverageLimit: c.coverageLimit,
      coInsurance: c.coInsurance,
      covered: JSON.parse(c.covered) as unknown,
      exclusions: JSON.parse(c.exclusions) as unknown,
    };
    coverageMap.set(c.id, {
      provider: c.provider,
      type: c.type,
      sourceDocumentId: c.documentId,
    });
    return parsed;
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    return NextResponse.json({ matches: [], error: 'search-unavailable' });
  }

  const requestId = randomUUID();
  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: buildPrompt(promptCoverages, query) }],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[search] upstream fetch failed', { requestId, err: (err as Error)?.name });
    return NextResponse.json({ matches: [], error: 'search-unavailable' });
  }

  if (!upstream.ok) {
    console.error('[search] upstream non-2xx', { requestId, status: upstream.status });
    return NextResponse.json({ matches: [], error: 'search-unavailable' });
  }

  let result: { content?: { text?: string }[] };
  try {
    result = await upstream.json();
  } catch {
    console.error('[search] upstream JSON parse failed', { requestId, status: upstream.status });
    return NextResponse.json({ matches: [], error: 'search-unavailable' });
  }

  const text = result.content?.[0]?.text || '';
  const parsed = parseJsonReply(text);
  if (!parsed) {
    console.error('[search] upstream content not parseable', { requestId });
    return NextResponse.json({ matches: [], error: 'search-unavailable' });
  }

  const enriched: EnrichedMatch[] = [];
  for (const raw of parsed.matches) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as Partial<ClaudeMatch>;
    if (typeof m.coverageId !== 'string') continue;
    const owned = coverageMap.get(m.coverageId);
    if (!owned) continue; // hallucination or another user's id — drop silently
    if (typeof m.citedValue !== 'string' || typeof m.explanation !== 'string') continue;
    if (typeof m.coordination !== 'string') continue;
    const relevance: Relevance = VALID_RELEVANCE.has(m.relevance as Relevance)
      ? (m.relevance as Relevance)
      : 'medium';
    const citedField: CitedField = VALID_CITED_FIELDS.has(m.citedField as CitedField)
      ? (m.citedField as CitedField)
      : 'summary';
    enriched.push({
      coverageId: m.coverageId,
      provider: owned.provider,
      type: owned.type,
      relevance,
      citedField,
      citedValue: m.citedValue,
      explanation: m.explanation,
      coordination: m.coordination,
      sourceDocumentId: owned.sourceDocumentId,
    });
  }

  return NextResponse.json({ matches: enriched });
}
