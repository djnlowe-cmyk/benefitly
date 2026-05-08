import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const sessionMock = vi.hoisted(() => ({
  current: { user: { id: 'placeholder' } } as { user: { id: string } } | null,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => sessionMock.current,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import prisma from '@/lib/db';
import { POST as searchPOST } from '@/app/api/search/route';
import type { NextRequest } from 'next/server';

type Fixture = {
  userA: string;
  userB: string;
  coverageA1: string;
  coverageA2: string;
  coverageB: string;
};

const fixture: Partial<Fixture> = {};

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function searchRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

function mockClaudeReply(payload: unknown) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : (url as URL).toString();
    if (!u.startsWith('https://api.anthropic.com/')) {
      throw new Error(`unexpected fetch in test: ${u}`);
    }
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(async () => {
  const userA = await prisma.user.create({
    data: { email: 'search-alice@example.test', name: 'Alice', passwordHash: 'x' },
  });
  const userB = await prisma.user.create({
    data: { email: 'search-bob@example.test', name: 'Bob', passwordHash: 'x' },
  });
  fixture.userA = userA.id;
  fixture.userB = userB.id;

  const coverageA1 = await prisma.coverage.create({
    data: {
      provider: 'Aviva',
      type: 'Travel — Annual Multi-Trip',
      category: 'travel',
      covered: JSON.stringify(['Trip cancellation up to £5,000', 'Medical emergencies abroad']),
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      exclusions: JSON.stringify(['Pre-existing conditions undeclared']),
      summary: 'UK annual multi-trip travel insurance with £5,000 cancellation cover.',
      userId: userA.id,
    },
  });
  const coverageA2 = await prisma.coverage.create({
    data: {
      provider: 'Direct Line',
      type: 'Motor — Comprehensive',
      category: 'auto',
      covered: JSON.stringify(['Accidental damage', 'Third-party liability']),
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      exclusions: JSON.stringify([]),
      userId: userA.id,
    },
  });
  const coverageB = await prisma.coverage.create({
    data: {
      provider: 'Bupa',
      type: 'Health',
      category: 'health',
      covered: JSON.stringify(['Diagnostic imaging including MRI']),
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      exclusions: JSON.stringify([]),
      userId: userB.id,
    },
  });
  fixture.coverageA1 = coverageA1.id;
  fixture.coverageA2 = coverageA2.id;
  fixture.coverageB = coverageB.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/search', () => {
  it('rejects an empty query with 400', async () => {
    asUser(fixture.userA!);
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const res = await searchPOST(searchRequest({ query: '   ' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('query required');
  });

  it('rejects an over-length query with 400', async () => {
    asUser(fixture.userA!);
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const res = await searchPOST(searchRequest({ query: 'x'.repeat(501) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('query too long');
  });

  it('returns 401 when there is no session', async () => {
    sessionMock.current = null;
    const res = await searchPOST(searchRequest({ query: 'travel cancellation' }));
    expect(res.status).toBe(401);
  });

  it('only returns hits whose coverageId belongs to the caller, dropping cross-user and fabricated ids', async () => {
    asUser(fixture.userA!);
    process.env.ANTHROPIC_API_KEY = 'sk-test';

    mockClaudeReply({
      results: [
        // Legit match against caller's travel policy.
        {
          coverageId: fixture.coverageA1,
          relevance: 'high',
          citedField: 'covered[0]',
          citedExcerpt: 'Trip cancellation up to £5,000',
          explanation: 'Aviva travel covers cancellation.',
          coordination: 'File with Aviva first.',
        },
        // Hostile: model returned another user's coverage id.
        {
          coverageId: fixture.coverageB,
          relevance: 'high',
          citedField: 'covered[0]',
          citedExcerpt: 'Diagnostic imaging including MRI',
          explanation: 'Should not appear.',
        },
        // Hostile: a fabricated id.
        {
          coverageId: '00000000-0000-0000-0000-000000000000',
          relevance: 'low',
          citedField: 'summary',
          citedExcerpt: 'fake',
          explanation: 'Should not appear.',
        },
      ],
    });

    const res = await searchPOST(searchRequest({ query: 'am I covered for travel cancellation' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].coverageId).toBe(fixture.coverageA1);
    expect(body.results[0].provider).toBe('Aviva');
    expect(body.results[0].citedExcerpt).toBe('Trip cancellation up to £5,000');
    expect(body.results[0].sourceDocumentId).toBeNull();
    expect(body.conciergeAvailable).toBe(true);
  });

  it('drops hits whose citedExcerpt does not appear in the source coverage (anti-hallucination)', async () => {
    asUser(fixture.userA!);
    process.env.ANTHROPIC_API_KEY = 'sk-test';

    mockClaudeReply({
      results: [
        {
          coverageId: fixture.coverageA1,
          relevance: 'high',
          citedField: 'covered[0]',
          // The model invented this string — it isn't a substring of the
          // coverage JSON anywhere. We expect the boundary fn to drop it.
          citedExcerpt: 'Includes pet boarding for up to 30 days',
          explanation: 'Should not appear.',
        },
      ],
      gapAnswer: {
        explanation: 'Nothing in your library covers that.',
        recommendedTypes: ['Travel insurance'],
      },
    });

    const res = await searchPOST(searchRequest({ query: 'pet boarding' }));
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.gapAnswer.explanation).toBe('Nothing in your library covers that.');
    expect(body.gapAnswer.recommendedTypes).toEqual(['Travel insurance']);
  });

  it('round-trips an empty results list with a gapAnswer cleanly', async () => {
    asUser(fixture.userA!);
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    mockClaudeReply({
      results: [],
      gapAnswer: {
        explanation: "You don't appear to have travel cancellation cover.",
        recommendedTypes: ['Travel insurance with cancellation cover'],
      },
    });
    const res = await searchPOST(searchRequest({ query: 'completely unrelated query' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.gapAnswer.recommendedTypes).toEqual([
      'Travel insurance with cancellation cover',
    ]);
    expect(body.error).toBeUndefined();
    expect(body.conciergeAvailable).toBe(true);
  });

  it('returns { results: [], error: "search-unavailable" } with status 200 when ANTHROPIC_API_KEY is missing', async () => {
    asUser(fixture.userA!);
    delete process.env.ANTHROPIC_API_KEY;
    // No fetch mock — the code path must short-circuit before any HTTP call.
    const res = await searchPOST(searchRequest({ query: 'travel cancellation' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.error).toBe('search-unavailable');
    expect(body.conciergeAvailable).toBe(true);
  });
});
