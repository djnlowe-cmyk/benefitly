import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import {
  searchCoverages,
  type SearchCoveragePromptRow,
  type SearchHit,
} from '@/lib/search/coverageSearch';
import { computeCost, recordClaudeCall } from '@/lib/claudeUsage';

// Frontend response shape. Keeps the route thin: route handles auth/db; the
// boundary fn handles the AI call + JSON parsing. We enrich each hit with
// provider/type/sourceDocumentId from the user's library so the UI doesn't
// need a second round-trip to render result cards.
interface EnrichedHit extends SearchHit {
  provider: string;
  type: string;
  sourceDocumentId: string | null;
}

interface SearchResponseBody {
  results: EnrichedHit[];
  gapAnswer?: { explanation: string; recommendedTypes: string[] };
  conciergeAvailable: true;
  error?: 'search-unavailable';
}

const QUERY_MAX = 500;

export async function POST(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { results: [], conciergeAvailable: true, error: 'query required' },
      { status: 400 },
    );
  }

  const rawQuery = (body as { query?: unknown } | null)?.query;
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) {
    return NextResponse.json(
      { results: [], conciergeAvailable: true, error: 'query required' },
      { status: 400 },
    );
  }
  if (query.length > QUERY_MAX) {
    return NextResponse.json(
      { results: [], conciergeAvailable: true, error: 'query too long' },
      { status: 400 },
    );
  }

  const [coverages, user] = await Promise.all([
    prisma.coverage.findMany({ where: { userId: session.userId } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { country: true, currency: true },
    }),
  ]);

  const lookup = new Map<
    string,
    { provider: string; type: string; sourceDocumentId: string | null }
  >();
  const promptRows: SearchCoveragePromptRow[] = coverages.map((c) => {
    lookup.set(c.id, {
      provider: c.provider,
      type: c.type,
      sourceDocumentId: c.documentId,
    });
    let covered: unknown = [];
    let exclusions: unknown = [];
    try {
      covered = JSON.parse(c.covered);
    } catch {
      covered = [];
    }
    try {
      exclusions = JSON.parse(c.exclusions);
    } catch {
      exclusions = [];
    }
    return {
      id: c.id,
      provider: c.provider,
      type: c.type,
      category: c.category,
      policyNo: c.policyNo,
      summary: c.summary,
      coverageLimit: c.coverageLimit,
      coInsurance: c.coInsurance,
      covered,
      exclusions,
    };
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    const body: SearchResponseBody = {
      results: [],
      conciergeAvailable: true,
      error: 'search-unavailable',
    };
    return NextResponse.json(body);
  }

  const region = {
    country: user?.country ?? 'GB',
    currency: user?.currency ?? 'GBP',
  };

  const { results, gapAnswer, usage, model } = await searchCoverages({
    coverages: promptRows,
    query,
    region,
    apiKey,
  });

  const enriched: EnrichedHit[] = [];
  for (const hit of results) {
    const owned = lookup.get(hit.coverageId);
    if (!owned) continue; // boundary fn already filters but keep the safety net
    enriched.push({
      ...hit,
      provider: owned.provider,
      type: owned.type,
      sourceDocumentId: owned.sourceDocumentId,
    });
  }

  const responseBody: SearchResponseBody = {
    results: enriched,
    conciergeAvailable: true,
    ...(enriched.length === 0 && gapAnswer ? { gapAnswer } : {}),
  };

  // ALI-121: persist a ClaudeUsage row when the upstream call landed (presence
  // of `model`/`usage` proves a real round-trip vs. a network/HTTP failure).
  // Mirror the £-cost into SearchEvent.costPence so the existing retention
  // dashboard sees per-search spend without a join.
  let costPence: number | null = null;
  if (model) {
    const cost = computeCost(model, usage);
    costPence = cost.costPence;
    recordClaudeCall({
      userId: session.userId,
      task: 'search-rerank',
      model,
      usage,
      successful: enriched.length > 0,
    });
  }

  // Fire-and-forget instrumentation. A write failure must NOT fail the search.
  prisma.searchEvent
    .create({
      data: {
        userId: session.userId,
        query,
        resultCount: enriched.length,
        successful: enriched.length > 0,
        costPence,
      },
    })
    .catch((err) => console.error('searchEvent insert failed', err));

  return NextResponse.json(responseBody);
}
