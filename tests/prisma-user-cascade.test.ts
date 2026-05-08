import { afterAll, describe, expect, it } from 'vitest';
import prisma from '@/lib/db';

// Load-bearing regression test for ALI-69 / DELETE /api/account.
//
// The account-deletion route relies on Prisma cascade rules to wipe every
// user-scoped table when prisma.user.delete fires. If anyone adds a new
// user-scoped relation without onDelete: Cascade, this test fails — and the
// failure points directly at the table they forgot to wire up.
//
// Whenever a new user-scoped table is added to prisma/schema.prisma, extend
// both the seed step and the assertion list below.

describe('prisma user cascade', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('deletes every user-scoped row when the User row is deleted', async () => {
    const user = await prisma.user.create({
      data: { email: 'cascade@example.test', name: 'Cascade User', passwordHash: 'x' },
    });
    const userId = user.id;

    const document = await prisma.document.create({
      data: {
        filename: 'policy.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storagePath: '/tmp/cascade/policy.pdf',
        userId,
      },
    });

    const coverage = await prisma.coverage.create({
      data: {
        provider: 'Aviva',
        type: 'Home',
        category: 'home',
        covered: '[]',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        exclusions: '[]',
        documentId: document.id,
        userId,
      },
    });

    await prisma.alert.create({
      data: {
        type: 'expiry',
        severity: 'medium',
        title: 'Renews soon',
        detail: 'Cascade alert',
        date: '2026-06-01',
        coverageId: coverage.id,
        userId,
      },
    });

    await prisma.transaction.create({
      data: {
        date: '2026-04-01',
        merchant: 'Apple',
        amount: 999,
        card: 'Amex',
        cardType: 'credit',
        category: 'electronics',
        coverageStatus: 'covered',
        userId,
      },
    });

    await prisma.asset.create({
      data: {
        name: 'MacBook Pro',
        category: 'electronics',
        value: 2500,
        purchaseDate: '2026-03-01',
        userId,
      },
    });

    await prisma.claim.create({
      data: {
        incident: 'Stolen laptop',
        date: '2026-04-15',
        provider: 'Aviva',
        category: 'home',
        userId,
      },
    });

    await prisma.familyMember.create({
      data: { name: 'Partner', relation: 'partner', userId },
    });

    // Sanity: every table seeded.
    expect(await prisma.document.count({ where: { userId } })).toBe(1);
    expect(await prisma.coverage.count({ where: { userId } })).toBe(1);
    expect(await prisma.alert.count({ where: { userId } })).toBe(1);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);
    expect(await prisma.asset.count({ where: { userId } })).toBe(1);
    expect(await prisma.claim.count({ where: { userId } })).toBe(1);
    expect(await prisma.familyMember.count({ where: { userId } })).toBe(1);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.document.count({ where: { userId } })).toBe(0);
    expect(await prisma.coverage.count({ where: { userId } })).toBe(0);
    expect(await prisma.alert.count({ where: { userId } })).toBe(0);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
    expect(await prisma.asset.count({ where: { userId } })).toBe(0);
    expect(await prisma.claim.count({ where: { userId } })).toBe(0);
    expect(await prisma.familyMember.count({ where: { userId } })).toBe(0);
  });
});
