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
import {
  GET as coverageGET,
  PATCH as coveragePATCH,
  DELETE as coverageDELETE,
} from '@/app/api/coverages/[id]/route';
import type { NextRequest } from 'next/server';

function asUser(id: string | null) {
  sessionMock.current = id ? { user: { id } } : null;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/coverages/x', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

function getRequest(): NextRequest {
  return new Request('http://localhost/api/coverages/x') as unknown as NextRequest;
}

function deleteRequest(): NextRequest {
  return new Request('http://localhost/api/coverages/x', { method: 'DELETE' }) as unknown as NextRequest;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const fixture = { userA: '', userB: '', coverageA: '', coverageB: '', documentA: '' };

beforeAll(async () => {
  const a = await prisma.user.create({
    data: { email: 'byid-alice@example.test', name: 'Alice', passwordHash: 'x' },
  });
  const b = await prisma.user.create({
    data: { email: 'byid-bob@example.test', name: 'Bob', passwordHash: 'x' },
  });
  fixture.userA = a.id;
  fixture.userB = b.id;
});

beforeEach(async () => {
  await prisma.alert.deleteMany({});
  await prisma.coverage.deleteMany({});
  await prisma.document.deleteMany({});

  const docA = await prisma.document.create({
    data: {
      filename: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: 'https://blob.example.com/users/alice/policy.pdf',
      userId: fixture.userA,
    },
  });
  fixture.documentA = docA.id;

  const covA = await prisma.coverage.create({
    data: {
      provider: 'Aviva',
      type: 'Home',
      category: 'home',
      covered: '[]',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      exclusions: '[]',
      confidence: 0.55,
      documentId: docA.id,
      userId: fixture.userA,
    },
  });
  const covB = await prisma.coverage.create({
    data: {
      provider: 'Direct Line',
      type: 'Auto',
      category: 'auto',
      covered: '[]',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      exclusions: '[]',
      userId: fixture.userB,
    },
  });
  fixture.coverageA = covA.id;
  fixture.coverageB = covB.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/coverages/[id]', () => {
  it('returns the coverage with document join but no URL (DPIA R-1)', async () => {
    asUser(fixture.userA);
    const res = await coverageGET(getRequest(), ctx(fixture.coverageA));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(fixture.coverageA);
    expect(body.confidence).toBe(0.55);
    // ALI-145: the document join must NOT include a `url` field — the client
    // must call /api/documents/[id]/url to mint a short-lived signed URL.
    expect(body.document).toEqual({
      id: fixture.documentA,
      filename: 'policy.pdf',
      mimeType: 'application/pdf',
    });
    expect(body.document).not.toHaveProperty('url');
    expect(body.document).not.toHaveProperty('storagePath');
  });

  it('never includes a url field even when storagePath looks like a public blob', async () => {
    // Even a doc whose storagePath is a (legacy) public URL must not leak it.
    asUser(fixture.userA);
    const res = await coverageGET(getRequest(), ctx(fixture.coverageA));
    const body = await res.json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('https://blob.example.com');
    expect(serialised).not.toContain('storagePath');
  });

  it('returns 401 when unauthenticated', async () => {
    asUser(null);
    const res = await coverageGET(getRequest(), ctx(fixture.coverageA));
    expect(res.status).toBe(401);
  });

  it('returns 404 when fetching another user\'s coverage', async () => {
    asUser(fixture.userA);
    const res = await coverageGET(getRequest(), ctx(fixture.coverageB));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/coverages/[id]', () => {
  it('updates fields and returns parsed JSON arrays', async () => {
    asUser(fixture.userA);
    const res = await coveragePATCH(
      patchRequest({ provider: 'Aviva Plus', covered: ['Buildings', 'Contents'] }),
      ctx(fixture.coverageA),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe('Aviva Plus');
    expect(body.covered).toEqual(['Buildings', 'Contents']);
  });

  it('triggers a renewal alert when endDate is updated to inside the window', async () => {
    asUser(fixture.userA);
    const endDate = daysFromNow(10);
    const res = await coveragePATCH(patchRequest({ endDate }), ctx(fixture.coverageA));
    expect(res.status).toBe(200);
    const alerts = await prisma.alert.findMany({
      where: { userId: fixture.userA, type: 'renewal', coverageId: fixture.coverageA },
    });
    expect(alerts).toHaveLength(1);
  });

  it('returns 404 when patching another user\'s coverage', async () => {
    asUser(fixture.userA);
    const res = await coveragePATCH(patchRequest({ provider: 'X' }), ctx(fixture.coverageB));
    expect(res.status).toBe(404);
    const stillThere = await prisma.coverage.findUnique({ where: { id: fixture.coverageB } });
    expect(stillThere?.provider).toBe('Direct Line');
  });

  it('returns 401 when unauthenticated', async () => {
    asUser(null);
    const res = await coveragePATCH(patchRequest({ provider: 'X' }), ctx(fixture.coverageA));
    expect(res.status).toBe(401);
  });

  // Mirrors ALI-75's defense-in-depth on the legacy collection PATCH so the
  // per-id route can't regress to leaking Prisma 500s when client traffic
  // sends a typed-wrong payload.
  it('rejects coverageLimit as a number with 400 (schema regression)', async () => {
    asUser(fixture.userA);
    const res = await coveragePATCH(patchRequest({ coverageLimit: 500 }), ctx(fixture.coverageA));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
    expect(Array.isArray(body.details)).toBe(true);
    expect(
      body.details.some(
        (d: { path?: unknown[] }) => Array.isArray(d.path) && d.path.includes('coverageLimit'),
      ),
    ).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Prisma|prisma/);
  });

  it('rejects malformed JSON body with 400', async () => {
    asUser(fixture.userA);
    const req = new Request('http://localhost/api/coverages/x', {
      method: 'PATCH',
      body: '{not json',
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest;
    const res = await coveragePATCH(req, ctx(fixture.coverageA));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/coverages/[id]', () => {
  it('deletes the caller\'s coverage', async () => {
    asUser(fixture.userA);
    const res = await coverageDELETE(deleteRequest(), ctx(fixture.coverageA));
    expect(res.status).toBe(200);
    const gone = await prisma.coverage.findUnique({ where: { id: fixture.coverageA } });
    expect(gone).toBeNull();
  });

  it('cannot delete another user\'s coverage', async () => {
    asUser(fixture.userA);
    const res = await coverageDELETE(deleteRequest(), ctx(fixture.coverageB));
    expect(res.status).toBe(404);
    const stillThere = await prisma.coverage.findUnique({ where: { id: fixture.coverageB } });
    expect(stillThere).not.toBeNull();
  });
});
