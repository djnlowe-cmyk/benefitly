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
import { DELETE as accountDELETE } from '@/app/api/account/route';

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
    data: { email: 'cascade-a@example.test', name: 'Cascade A', passwordHash: 'x' },
  });
  const userB = await prisma.user.create({
    data: { email: 'cascade-b@example.test', name: 'Cascade B', passwordHash: 'x' },
  });
  fixture.userA = userA.id;
  fixture.userB = userB.id;

  for (const userId of [userA.id, userB.id]) {
    await prisma.coverage.create({
      data: {
        provider: 'Aviva', type: 'Auto', category: 'auto',
        covered: '[]', startDate: '2026-01-01', endDate: '2026-12-31',
        exclusions: '[]',
        userId,
      },
    });
    await prisma.document.create({
      data: {
        filename: 'policy.pdf', mimeType: 'application/pdf', size: 1024,
        storagePath: `local/${userId}/policy.pdf`,
        userId,
      },
    });
    await prisma.alert.create({
      data: {
        type: 'expiry', severity: 'medium', title: 'Renews soon',
        detail: 'msg', date: '2026-06-01', userId,
      },
    });
    await prisma.transaction.create({
      data: {
        date: '2026-04-01', merchant: 'BUPA', amount: 12.5, card: 'Amex',
        cardType: 'credit', category: 'health', coverageStatus: 'covered',
        userId,
      },
    });
    await prisma.asset.create({
      data: {
        name: 'Laptop', category: 'tech', value: 1200, purchaseDate: '2025-12-01',
        userId,
      },
    });
    await prisma.claim.create({
      data: {
        incident: 'Bumped car', date: '2026-03-15', provider: 'Aviva', category: 'auto',
        userId,
      },
    });
    await prisma.familyMember.create({
      data: { name: 'Spouse', relation: 'spouse', userId },
    });
  }
});

afterAll(async () => {
  // user A is deleted by the test; clean up user B + descendants if still present
  if (fixture.userB) {
    await prisma.user.deleteMany({ where: { id: fixture.userB } });
  }
  await prisma.$disconnect();
});

describe('DELETE /api/account', () => {
  it('returns 401 when unauthenticated', async () => {
    asAnonymous();
    const res = await accountDELETE();
    expect(res.status).toBe(401);
  });

  it('cascades delete across every owned table for user A and leaves user B intact', async () => {
    asUser(fixture.userA!);
    const res = await accountDELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    // User A is gone
    const removedUser = await prisma.user.findUnique({ where: { id: fixture.userA! } });
    expect(removedUser).toBeNull();

    // Every owned table is empty for user A
    expect(await prisma.coverage.findMany({ where: { userId: fixture.userA! } })).toEqual([]);
    expect(await prisma.document.findMany({ where: { userId: fixture.userA! } })).toEqual([]);
    expect(await prisma.alert.findMany({ where: { userId: fixture.userA! } })).toEqual([]);
    expect(await prisma.transaction.findMany({ where: { userId: fixture.userA! } })).toEqual([]);
    expect(await prisma.asset.findMany({ where: { userId: fixture.userA! } })).toEqual([]);
    expect(await prisma.claim.findMany({ where: { userId: fixture.userA! } })).toEqual([]);
    expect(await prisma.familyMember.findMany({ where: { userId: fixture.userA! } })).toEqual([]);

    // User B's rows are untouched
    const userB = await prisma.user.findUnique({ where: { id: fixture.userB! } });
    expect(userB).not.toBeNull();
    expect((await prisma.coverage.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
    expect((await prisma.document.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
    expect((await prisma.alert.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
    expect((await prisma.transaction.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
    expect((await prisma.asset.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
    expect((await prisma.claim.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
    expect((await prisma.familyMember.findMany({ where: { userId: fixture.userB! } })).length).toBe(1);
  });
});
