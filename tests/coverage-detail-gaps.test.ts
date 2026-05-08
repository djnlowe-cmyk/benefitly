import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { GET as coverageDetailGET } from '@/app/api/coverages/[id]/route';
import { POST as gapDismissPOST } from '@/app/api/coverages/[id]/gaps/[gapKey]/dismiss/route';
import type { Gap } from '@/types/coverage';

type Fixture = {
  userA: string;
  userB: string;
};

const fixture: Partial<Fixture> = {};

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function asAnonymous() {
  sessionMock.current = null;
}

beforeAll(async () => {
  const userA = await prisma.user.create({
    data: { email: 'gap-a@example.test', name: 'Gap A', passwordHash: 'x' },
  });
  const userB = await prisma.user.create({
    data: { email: 'gap-b@example.test', name: 'Gap B', passwordHash: 'x' },
  });
  fixture.userA = userA.id;
  fixture.userB = userB.id;
});

beforeEach(async () => {
  await prisma.coverageGapDismissal.deleteMany({
    where: { userId: { in: [fixture.userA!, fixture.userB!] } },
  });
  await prisma.coverage.deleteMany({
    where: { userId: { in: [fixture.userA!, fixture.userB!] } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createCoverage(userId: string, overrides: Record<string, unknown>) {
  return prisma.coverage.create({
    data: {
      provider: overrides.provider ?? 'Aviva',
      type: overrides.type ?? 'Home contents',
      category: overrides.category ?? 'home',
      covered: JSON.stringify(overrides.covered ?? []),
      exclusions: JSON.stringify(overrides.exclusions ?? []),
      coverageLimit: overrides.coverageLimit ?? null,
      deductible: overrides.deductible ?? null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      userId,
      ...(overrides.status ? { status: overrides.status } : {}),
    } as Parameters<typeof prisma.coverage.create>[0]['data'],
  });
}

describe('GET /api/coverages/:id', () => {
  it('returns 401 when not signed in', async () => {
    asAnonymous();
    const res = await coverageDetailGET(new Request('http://localhost/api/coverages/x'), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when reading another user's coverage", async () => {
    const homeB = await createCoverage(fixture.userB!, { exclusions: ['Flood'] });
    asUser(fixture.userA!);
    const res = await coverageDetailGET(new Request(`http://localhost/api/coverages/${homeB.id}`), {
      params: Promise.resolve({ id: homeB.id }),
    });
    expect(res.status).toBe(404);
  });

  it('returns the coverage with gaps[] populated and JSON-parsed covered/exclusions', async () => {
    const home = await createCoverage(fixture.userA!, {
      provider: 'Aviva',
      type: 'Home contents',
      category: 'home',
      covered: ['Theft', 'Fire'],
      exclusions: ['Flood damage'],
      coverageLimit: '£5,000',
    });

    asUser(fixture.userA!);
    const res = await coverageDetailGET(new Request(`http://localhost/api/coverages/${home.id}`), {
      params: Promise.resolve({ id: home.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      covered: string[];
      exclusions: string[];
      gaps: Gap[];
    };
    expect(body.id).toBe(home.id);
    expect(body.covered).toEqual(['Theft', 'Fire']);
    expect(body.exclusions).toEqual(['Flood damage']);
    const gapKeys = body.gaps.map((g) => g.key);
    expect(gapKeys).toContain('exclusion:flood');
    expect(gapKeys).toContain('low_limit:home_contents');
  });

  it('respects dismissals for the same (user, coverage, gapKey)', async () => {
    const home = await createCoverage(fixture.userA!, {
      provider: 'Aviva',
      type: 'Home contents',
      exclusions: ['Flood damage'],
    });
    asUser(fixture.userA!);

    const dismissRes = await gapDismissPOST(
      new Request(
        `http://localhost/api/coverages/${home.id}/gaps/${encodeURIComponent('exclusion:flood')}/dismiss`,
        { method: 'POST', body: JSON.stringify({ reason: 'have_elsewhere' }), headers: { 'Content-Type': 'application/json' } },
      ) as never,
      { params: Promise.resolve({ id: home.id, gapKey: encodeURIComponent('exclusion:flood') }) },
    );
    expect(dismissRes.status).toBe(200);

    const res = await coverageDetailGET(new Request(`http://localhost/api/coverages/${home.id}`), {
      params: Promise.resolve({ id: home.id }),
    });
    const body = (await res.json()) as { gaps: Gap[] };
    expect(body.gaps.find((g) => g.key === 'exclusion:flood')).toBeUndefined();

    // Idempotent: second dismiss with same key returns 200, not a duplicate row.
    const again = await gapDismissPOST(
      new Request(
        `http://localhost/api/coverages/${home.id}/gaps/${encodeURIComponent('exclusion:flood')}/dismiss`,
        { method: 'POST', body: JSON.stringify({ reason: 'not_relevant' }), headers: { 'Content-Type': 'application/json' } },
      ) as never,
      { params: Promise.resolve({ id: home.id, gapKey: encodeURIComponent('exclusion:flood') }) },
    );
    expect(again.status).toBe(200);
    const total = await prisma.coverageGapDismissal.count({
      where: { userId: fixture.userA, coverageId: home.id, gapKey: 'exclusion:flood' },
    });
    expect(total).toBe(1);
  });

  it('user A dismissals do not affect user B', async () => {
    const homeA = await createCoverage(fixture.userA!, { exclusions: ['Flood damage'] });
    const homeB = await createCoverage(fixture.userB!, { exclusions: ['Flood damage'] });

    asUser(fixture.userA!);
    await gapDismissPOST(
      new Request(
        `http://localhost/api/coverages/${homeA.id}/gaps/${encodeURIComponent('exclusion:flood')}/dismiss`,
        { method: 'POST', body: JSON.stringify({ reason: 'have_elsewhere' }), headers: { 'Content-Type': 'application/json' } },
      ) as never,
      { params: Promise.resolve({ id: homeA.id, gapKey: encodeURIComponent('exclusion:flood') }) },
    );

    asUser(fixture.userB!);
    const res = await coverageDetailGET(new Request(`http://localhost/api/coverages/${homeB.id}`), {
      params: Promise.resolve({ id: homeB.id }),
    });
    const body = (await res.json()) as { gaps: Gap[] };
    expect(body.gaps.find((g) => g.key === 'exclusion:flood')).toBeDefined();
  });

  it('cannot dismiss a gap on another user\'s coverage', async () => {
    const homeB = await createCoverage(fixture.userB!, { exclusions: ['Flood damage'] });
    asUser(fixture.userA!);
    const res = await gapDismissPOST(
      new Request(
        `http://localhost/api/coverages/${homeB.id}/gaps/${encodeURIComponent('exclusion:flood')}/dismiss`,
        { method: 'POST', body: JSON.stringify({ reason: 'not_relevant' }), headers: { 'Content-Type': 'application/json' } },
      ) as never,
      { params: Promise.resolve({ id: homeB.id, gapKey: encodeURIComponent('exclusion:flood') }) },
    );
    expect(res.status).toBe(404);
    const stored = await prisma.coverageGapDismissal.findFirst({
      where: { coverageId: homeB.id },
    });
    expect(stored).toBeNull();
  });

  it('rejects invalid dismiss reasons', async () => {
    const home = await createCoverage(fixture.userA!, { exclusions: ['Flood damage'] });
    asUser(fixture.userA!);
    const res = await gapDismissPOST(
      new Request(
        `http://localhost/api/coverages/${home.id}/gaps/${encodeURIComponent('exclusion:flood')}/dismiss`,
        { method: 'POST', body: JSON.stringify({ reason: 'lol' }), headers: { 'Content-Type': 'application/json' } },
      ) as never,
      { params: Promise.resolve({ id: home.id, gapKey: encodeURIComponent('exclusion:flood') }) },
    );
    expect(res.status).toBe(400);
  });
});
