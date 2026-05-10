import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
import { GET as coveragesGET, POST as coveragesPOST, DELETE as coveragesDELETE } from '@/app/api/coverages/route';
import { GET as alertsGET, PATCH as alertsPATCH } from '@/app/api/alerts/route';
import { GET as familyGET, POST as familyPOST, DELETE as familyDELETE } from '@/app/api/family/route';

type Fixture = {
  userA: string;
  userB: string;
  coverageA: string;
  coverageB: string;
  alertA: string;
  alertB: string;
  familyA: string;
  familyB: string;
};

const fixture: Partial<Fixture> = {};

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function asAnonymous() {
  sessionMock.current = null;
}

// Real Next.js always passes a NextRequest to GET handlers; the apiLog wrapper
// now reads req.method, so tests can no longer call the handlers bare-handed.
function getReq(path: string): import('next/server').NextRequest {
  return new Request(`http://localhost${path}`, { method: 'GET' }) as unknown as import('next/server').NextRequest;
}

beforeAll(async () => {
  const userA = await prisma.user.create({
    data: { email: 'alice@example.test', name: 'Alice', passwordHash: 'x' },
  });
  const userB = await prisma.user.create({
    data: { email: 'bob@example.test', name: 'Bob', passwordHash: 'x' },
  });
  fixture.userA = userA.id;
  fixture.userB = userB.id;

  const coverageA = await prisma.coverage.create({
    data: {
      provider: 'BCBS', type: 'Health', category: 'health',
      covered: '[]', startDate: '2026-01-01', endDate: '2026-12-31',
      exclusions: '[]',
      userId: userA.id,
    },
  });
  const coverageB = await prisma.coverage.create({
    data: {
      provider: 'Aviva', type: 'Auto', category: 'auto',
      covered: '[]', startDate: '2026-01-01', endDate: '2026-12-31',
      exclusions: '[]',
      userId: userB.id,
    },
  });
  fixture.coverageA = coverageA.id;
  fixture.coverageB = coverageB.id;

  const alertA = await prisma.alert.create({
    data: {
      type: 'expiry', severity: 'medium', title: 'Renews soon',
      detail: 'A', date: '2026-06-01', userId: userA.id,
    },
  });
  const alertB = await prisma.alert.create({
    data: {
      type: 'expiry', severity: 'medium', title: 'Renews soon',
      detail: 'B', date: '2026-06-01', userId: userB.id,
    },
  });
  fixture.alertA = alertA.id;
  fixture.alertB = alertB.id;

  const familyA = await prisma.familyMember.create({
    data: { name: 'Alice Jr', relation: 'child', userId: userA.id },
  });
  const familyB = await prisma.familyMember.create({
    data: { name: 'Bob Jr', relation: 'child', userId: userB.id },
  });
  fixture.familyA = familyA.id;
  fixture.familyB = familyB.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('unauthenticated requests', () => {
  it('returns 401 from every protected route when there is no session', async () => {
    asAnonymous();

    expect((await coveragesGET(getReq('/api/coverages'))).status).toBe(401);
    expect((await alertsGET(getReq('/api/alerts'))).status).toBe(401);
    expect((await familyGET(getReq('/api/family'))).status).toBe(401);
  });
});

describe('cross-user data isolation', () => {
  it('GET /api/coverages only returns the caller-user rows', async () => {
    asUser(fixture.userA!);
    const aRes = await coveragesGET(getReq('/api/coverages'));
    const aRows = await aRes.json();
    expect(aRows.map((r: { id: string }) => r.id)).toEqual([fixture.coverageA]);

    asUser(fixture.userB!);
    const bRes = await coveragesGET(getReq('/api/coverages'));
    const bRows = await bRes.json();
    expect(bRows.map((r: { id: string }) => r.id)).toEqual([fixture.coverageB]);
  });

  it('GET /api/alerts only returns the caller-user rows', async () => {
    asUser(fixture.userA!);
    const a = await (await alertsGET(getReq('/api/alerts'))).json();
    expect(a.map((r: { id: string }) => r.id)).toEqual([fixture.alertA]);

    asUser(fixture.userB!);
    const b = await (await alertsGET(getReq('/api/alerts'))).json();
    expect(b.map((r: { id: string }) => r.id)).toEqual([fixture.alertB]);
  });

  it('GET /api/family only returns the caller-user rows', async () => {
    asUser(fixture.userA!);
    const a = await (await familyGET(getReq('/api/family'))).json();
    expect(a.map((r: { id: string }) => r.id)).toEqual([fixture.familyA]);

    asUser(fixture.userB!);
    const b = await (await familyGET(getReq('/api/family'))).json();
    expect(b.map((r: { id: string }) => r.id)).toEqual([fixture.familyB]);
  });
});

describe('cross-user mutation guards', () => {
  it('cannot DELETE another user\'s Coverage by id', async () => {
    asUser(fixture.userA!);
    const req = new Request(`http://localhost/api/coverages?id=${fixture.coverageB}`, { method: 'DELETE' });
    const res = await coveragesDELETE(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(404);

    const stillThere = await prisma.coverage.findUnique({ where: { id: fixture.coverageB! } });
    expect(stillThere).not.toBeNull();
  });

  it('cannot DELETE another user\'s FamilyMember by id', async () => {
    asUser(fixture.userA!);
    const req = new Request(`http://localhost/api/family?id=${fixture.familyB}`, { method: 'DELETE' });
    const res = await familyDELETE(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(404);

    const stillThere = await prisma.familyMember.findUnique({ where: { id: fixture.familyB! } });
    expect(stillThere).not.toBeNull();
  });

  it('cannot PATCH another user\'s Alert by id', async () => {
    asUser(fixture.userA!);
    const req = new Request('http://localhost/api/alerts', {
      method: 'PATCH',
      body: JSON.stringify({ id: fixture.alertB, read: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await alertsPATCH(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(404);

    const untouched = await prisma.alert.findUnique({ where: { id: fixture.alertB! } });
    expect(untouched?.read).toBe(false);
  });

  it('POST /api/coverages always stamps the caller userId, ignoring any client-supplied userId', async () => {
    asUser(fixture.userA!);
    const req = new Request('http://localhost/api/coverages', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'Tricked', type: 'Health', category: 'health',
        startDate: '2026-01-01', endDate: '2026-12-31',
        userId: fixture.userB,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await coveragesPOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(201);
    const created = await res.json();
    const persisted = await prisma.coverage.findUnique({ where: { id: created.id } });
    expect(persisted?.userId).toBe(fixture.userA);
  });

  it('POST /api/family always stamps the caller userId', async () => {
    asUser(fixture.userA!);
    const req = new Request('http://localhost/api/family', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bystander', relation: 'spouse', userId: fixture.userB }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await familyPOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(201);
    const created = await res.json();
    const persisted = await prisma.familyMember.findUnique({ where: { id: created.id } });
    expect(persisted?.userId).toBe(fixture.userA);
  });
});
