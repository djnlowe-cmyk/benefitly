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
import { POST as conciergePOST } from '@/app/api/search/concierge/route';
import type { NextRequest } from 'next/server';

let userA = '';
let userB = '';

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function conciergeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/search/concierge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  const a = await prisma.user.create({
    data: { email: 'concierge-alice@example.test', name: 'Alice', passwordHash: 'x' },
  });
  const b = await prisma.user.create({
    data: { email: 'concierge-bob@example.test', name: 'Bob', passwordHash: 'x' },
  });
  userA = a.id;
  userB = b.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/search/concierge', () => {
  it('returns 401 without a session', async () => {
    sessionMock.current = null;
    const res = await conciergePOST(conciergeRequest({ query: 'something' }));
    expect(res.status).toBe(401);
  });

  it('rejects an empty query with 400', async () => {
    asUser(userA);
    const res = await conciergePOST(conciergeRequest({ query: '   ' }));
    expect(res.status).toBe(400);
  });

  it('persists a row tied to the caller and returns ok:true', async () => {
    asUser(userA);
    const res = await conciergePOST(
      conciergeRequest({
        query: 'My laptop screen cracked, am I covered?',
        expectedAnswer: 'AppleCare or home contents accidental damage',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const rows = await prisma.conciergeQuery.findMany({ where: { userId: userA } });
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBe('My laptop screen cracked, am I covered?');
    expect(rows[0].expectedAnswer).toBe('AppleCare or home contents accidental damage');
    expect(rows[0].status).toBe('pending');
  });

  it('does not leak across users — userB submitting only persists under userB', async () => {
    asUser(userB);
    const res = await conciergePOST(
      conciergeRequest({ query: 'Is private GP covered?' }),
    );
    expect(res.status).toBe(200);

    const aRows = await prisma.conciergeQuery.findMany({ where: { userId: userA } });
    const bRows = await prisma.conciergeQuery.findMany({ where: { userId: userB } });
    expect(aRows.every((r) => r.userId === userA)).toBe(true);
    expect(bRows).toHaveLength(1);
    expect(bRows[0].userId).toBe(userB);
    expect(bRows[0].expectedAnswer).toBeNull();
  });

  it('rejects an over-length query with 400', async () => {
    asUser(userA);
    const res = await conciergePOST(conciergeRequest({ query: 'x'.repeat(501) }));
    expect(res.status).toBe(400);
  });
});
