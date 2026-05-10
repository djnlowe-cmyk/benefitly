import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  COST_THRESHOLDS_PENCE,
  buildDigestReport,
  computeStats,
  formatPence,
  getDocumentRows,
  getUserRows,
} from '@/lib/costMetrics';
import { computeCost } from '@/lib/claudeUsage';
import prisma from '@/lib/db';

// ALI-121 acceptance: persisting per-call cost records, surfacing cohort
// stats, and the £1.10 trip-wire flag — all without a Claude API key.
//
// Storage mock: the upload-path regression test must not exercise Vercel
// Blob or the local FS. We stub `getDocumentStorage` for that file. The
// other tests in this suite drive cost rows directly via prisma, which
// means they don't need the storage backend.

vi.mock('@/lib/storage', () => ({
  getDocumentStorage: () => ({
    put: vi.fn(async ({ filename }: { filename: string }) => ({
      storagePath: `/test/uploads/${filename}`,
      url: null,
    })),
    del: vi.fn(),
  }),
}));

const sessionMock = vi.hoisted(() => ({
  current: { user: { id: 'placeholder' } } as { user: { id: string } } | null,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => sessionMock.current,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { POST as uploadPOST } from '@/app/api/upload/route';

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function uploadRequest(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: fd,
  }) as unknown as Parameters<typeof uploadPOST>[0];
}

function mockClaudeReply(payload: unknown, usage?: Record<string, number>) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : (url as URL).toString();
    if (!u.startsWith('https://api.anthropic.com/')) {
      throw new Error(`unexpected fetch in test: ${u}`);
    }
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        usage,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let userId: string;

beforeAll(async () => {
  const u = await prisma.user.create({
    data: { email: 'cost-suite@example.test', name: 'Cost', passwordHash: 'x' },
  });
  userId = u.id;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Clear cost rows + documents created during a test so subsequent tests
  // start with a clean cohort. Other tests in the suite create their own
  // users so a global wipe is safe here.
  await prisma.claudeUsage.deleteMany({});
  await prisma.document.deleteMany({});
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('computeCost', () => {
  it('returns zero cost for an unknown model but preserves token counts', () => {
    const result = computeCost('unknown-model-2099', {
      input_tokens: 100,
      output_tokens: 50,
    });
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.costPence).toBe(0);
  });

  it('prices Sonnet 4 input/output tokens in GBP pence', () => {
    // 1M input + 1M output at $3 + $15 = $18; at 0.79 USD→GBP = £14.22 = 1422p.
    process.env.USD_GBP_RATE = '0.79';
    const result = computeCost('claude-sonnet-4-20250514', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(result.costPence).toBe(1422);
  });

  it('prices cache-read tokens cheaper than fresh input', () => {
    process.env.USD_GBP_RATE = '0.79';
    const fresh = computeCost('claude-sonnet-4-20250514', {
      input_tokens: 1_000_000,
    });
    const cached = computeCost('claude-sonnet-4-20250514', {
      cache_read_input_tokens: 1_000_000,
    });
    expect(cached.costPence).toBeLessThan(fresh.costPence);
  });

  it('handles a missing usage block gracefully', () => {
    const result = computeCost('claude-sonnet-4-20250514', null);
    expect(result.inputTokens).toBe(0);
    expect(result.costPence).toBe(0);
  });
});

describe('computeStats', () => {
  it('returns zeros for an empty cohort', () => {
    const s = computeStats([]);
    expect(s).toEqual({ median: 0, p90: 0, mean: 0, count: 0, totalPence: 0 });
  });

  it('computes median and p90 over linear-interpolated percentiles', () => {
    const s = computeStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(s.count).toBe(10);
    expect(s.median).toBeCloseTo(55, 5);
    expect(s.p90).toBeCloseTo(91, 5);
  });
});

describe('formatPence', () => {
  it('renders £1.10 from 110p', () => {
    expect(formatPence(110)).toBe('£1.10');
  });
  it('renders £0.00 from 0p', () => {
    expect(formatPence(0)).toBe('£0.00');
  });
});

describe('POST /api/upload — Claude cost recording', () => {
  it('writes a ClaudeUsage row with parse task + computed costPence', async () => {
    asUser(userId);
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.USD_GBP_RATE = '0.79';

    mockClaudeReply(
      {
        provider: 'Aviva',
        type: 'Travel',
        category: 'travel',
        covered: ['Trip cancellation'],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        exclusions: [],
        confidence: 0.95,
      },
      { input_tokens: 5000, output_tokens: 500 },
    );

    const file = new File([Buffer.from('fake-pdf')], 'aviva-travel.pdf', {
      type: 'application/pdf',
    });

    const res = await uploadPOST(uploadRequest(file));
    expect(res.status).toBe(201);

    const rows = await prisma.claudeUsage.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.task).toBe('parse');
    expect(row.model).toBe('claude-sonnet-4-20250514');
    expect(row.inputTokens).toBe(5000);
    expect(row.outputTokens).toBe(500);
    expect(row.successful).toBe(true);
    // 5000 input * $3 + 500 output * $15 = $0.0225; * 0.79 = £0.0177… → 2p.
    expect(row.costPence).toBeGreaterThan(0);
    expect(row.documentId).toBeTruthy();
  });

  it('still writes a ClaudeUsage row when Claude returns malformed JSON, marked unsuccessful', async () => {
    asUser(userId);
    process.env.ANTHROPIC_API_KEY = 'sk-test';

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'not even close to JSON' }],
          usage: { input_tokens: 1000, output_tokens: 0 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = new File([Buffer.from('fake')], 'broken.pdf', {
      type: 'application/pdf',
    });
    const res = await uploadPOST(uploadRequest(file));
    expect(res.status).toBe(201);

    const rows = await prisma.claudeUsage.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].successful).toBe(false);
    expect(rows[0].inputTokens).toBe(1000);
  });

  it('does NOT write a ClaudeUsage row when ANTHROPIC_API_KEY is unset (skips the call)', async () => {
    asUser(userId);
    delete process.env.ANTHROPIC_API_KEY;
    const file = new File([Buffer.from('x')], 'noop.pdf', { type: 'application/pdf' });
    const res = await uploadPOST(uploadRequest(file));
    expect(res.status).toBe(201);
    const rows = await prisma.claudeUsage.findMany({ where: { userId } });
    expect(rows).toHaveLength(0);
  });
});

describe('cost dashboard aggregations', () => {
  it('rolls up per-user spend with a cache-hit ratio', async () => {
    await prisma.claudeUsage.createMany({
      data: [
        {
          userId,
          task: 'parse',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 200,
          cacheReadTokens: 500,
          cacheCreationTokens: 0,
          costPence: 80,
        },
        {
          userId,
          task: 'search-rerank',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 500,
          outputTokens: 100,
          cacheReadTokens: 1000,
          cacheCreationTokens: 0,
          costPence: 30,
        },
      ],
    });
    const rows = await getUserRows({ windowDays: 30 });
    expect(rows).toHaveLength(1);
    expect(rows[0].callCount).toBe(2);
    expect(rows[0].totalPence).toBe(110);
    // 1500 cached / (1500 cached + 1500 fresh input) = 0.5
    expect(rows[0].cacheHitRate).toBeCloseTo(0.5, 5);
  });

  it('returns per-document rows newest-first with cache-hit %', async () => {
    const doc = await prisma.document.create({
      data: {
        filename: 'aviva.pdf',
        mimeType: 'application/pdf',
        size: 100,
        storagePath: '/test/aviva.pdf',
        userId,
        parsedData: JSON.stringify({ category: 'travel' }),
      },
    });
    await prisma.claudeUsage.create({
      data: {
        userId,
        documentId: doc.id,
        task: 'parse',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costPence: 5,
      },
    });
    const rows = await getDocumentRows({ limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].filename).toBe('aviva.pdf');
    expect(rows[0].category).toBe('travel');
    expect(rows[0].costPence).toBe(5);
    expect(rows[0].cacheHitRate).toBe(0);
  });
});

describe('weekly digest', () => {
  it('flags trip-wire breach when median ≥ £1.10 in the current week', async () => {
    // Five users, each at 110p median. Window = last 7 days, so createdAt = now.
    const users = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        prisma.user.create({
          data: {
            email: `digest-${i}@example.test`,
            name: `D${i}`,
            passwordHash: 'x',
          },
        }),
      ),
    );
    await prisma.claudeUsage.createMany({
      data: users.map((u) => ({
        userId: u.id,
        task: 'parse',
        model: 'claude-sonnet-4-20250514',
        costPence: 110,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      })),
    });

    const report = await buildDigestReport();
    expect(report.current.cohort.median).toBe(COST_THRESHOLDS_PENCE.tripWire);
    expect(report.tripWireBreached).toBe(true);
    // Previous week has no rows so consecutive should be false.
    expect(report.tripWireConsecutive).toBe(false);

    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });

  it('does not flag trip-wire when current median is comfortably under £1.10', async () => {
    const u = await prisma.user.create({
      data: { email: 'digest-cheap@example.test', name: 'C', passwordHash: 'x' },
    });
    await prisma.claudeUsage.create({
      data: {
        userId: u.id,
        task: 'parse',
        model: 'claude-sonnet-4-20250514',
        costPence: 50,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
    });
    const report = await buildDigestReport();
    expect(report.tripWireBreached).toBe(false);
    expect(report.overPhase1Cap).toBe(false);
    await prisma.user.deleteMany({ where: { id: u.id } });
  });
});
