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
import { POST as coveragesPOST, PATCH as coveragesPATCH } from '@/app/api/coverages/route';
import { ensureRenewalAlert } from '@/lib/alerts/renewal';
import type { NextRequest } from 'next/server';

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function postRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/coverages', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

function patchRequest(id: string, body: unknown): NextRequest {
  return new Request(`http://localhost/api/coverages?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const fixture = { userA: '', userB: '' };

beforeAll(async () => {
  const a = await prisma.user.create({
    data: { email: 'renewal-alice@example.test', name: 'Alice', passwordHash: 'x', country: 'GB', currency: 'GBP' },
  });
  const b = await prisma.user.create({
    data: { email: 'renewal-bob@example.test', name: 'Bob', passwordHash: 'x', country: 'GB', currency: 'GBP' },
  });
  fixture.userA = a.id;
  fixture.userB = b.id;
});

beforeEach(async () => {
  await prisma.alert.deleteMany({});
  await prisma.coverage.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('renewal alert-on-save', () => {
  it('creates a renewal alert when endDate is 14 days out, with UK-formatted title', async () => {
    asUser(fixture.userA);
    const endDate = daysFromNow(14);
    const res = await coveragesPOST(
      postRequest({
        provider: 'Aviva',
        type: 'Motor — Comprehensive',
        category: 'auto',
        startDate: '2026-01-01',
        endDate,
        covered: [],
        exclusions: [],
      }),
    );
    expect(res.status).toBe(201);

    const alerts = await prisma.alert.findMany({ where: { userId: fixture.userA, type: 'renewal' } });
    expect(alerts).toHaveLength(1);

    // UK format dd/MM/yyyy
    const [y, m, d] = endDate.split('-');
    expect(alerts[0].title).toContain(`${d}/${m}/${y}`);
    expect(alerts[0].title).toContain('Aviva');
    expect(alerts[0].title).toContain('Motor — Comprehensive');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].read).toBe(false);
  });

  it('is idempotent — re-saving via PATCH does not create a second alert', async () => {
    asUser(fixture.userA);
    const endDate = daysFromNow(14);
    const created = await coveragesPOST(
      postRequest({
        provider: 'Aviva',
        type: 'Motor',
        category: 'auto',
        startDate: '2026-01-01',
        endDate,
        covered: [],
        exclusions: [],
      }),
    );
    const createdBody = (await created.json()) as { id: string };

    const patched = await coveragesPATCH(patchRequest(createdBody.id, { endDate }));
    expect(patched.status).toBe(200);

    const alerts = await prisma.alert.findMany({ where: { userId: fixture.userA, type: 'renewal' } });
    expect(alerts).toHaveLength(1);
  });

  it('does not create an alert when endDate is 60 days out', async () => {
    asUser(fixture.userA);
    await coveragesPOST(
      postRequest({
        provider: 'Aviva',
        type: 'Motor',
        category: 'auto',
        startDate: '2026-01-01',
        endDate: daysFromNow(60),
        covered: [],
        exclusions: [],
      }),
    );
    const alerts = await prisma.alert.findMany({ where: { userId: fixture.userA, type: 'renewal' } });
    expect(alerts).toHaveLength(0);
  });

  it('does not create an alert when endDate is in the past', async () => {
    asUser(fixture.userA);
    await coveragesPOST(
      postRequest({
        provider: 'Aviva',
        type: 'Motor',
        category: 'auto',
        startDate: '2020-01-01',
        endDate: daysFromNow(-5),
        covered: [],
        exclusions: [],
      }),
    );
    const alerts = await prisma.alert.findMany({ where: { userId: fixture.userA, type: 'renewal' } });
    expect(alerts).toHaveLength(0);
  });

  it('returns {created:false} when endDate is null (helper unit case)', async () => {
    const coverage = await prisma.coverage.create({
      data: {
        provider: 'Aviva',
        type: 'Motor',
        category: 'auto',
        covered: '[]',
        startDate: '2026-01-01',
        endDate: '',
        exclusions: '[]',
        userId: fixture.userA,
      },
    });
    const result = await ensureRenewalAlert(prisma, {
      coverage: { id: coverage.id, provider: 'Aviva', type: 'Motor', endDate: null },
      userId: fixture.userA,
    });
    expect(result.created).toBe(false);
    const alerts = await prisma.alert.findMany({ where: { coverageId: coverage.id } });
    expect(alerts).toHaveLength(0);
  });

  it('does not leak alerts across users — userA save creates no alert visible to userB', async () => {
    asUser(fixture.userA);
    await coveragesPOST(
      postRequest({
        provider: 'Aviva',
        type: 'Motor',
        category: 'auto',
        startDate: '2026-01-01',
        endDate: daysFromNow(10),
        covered: [],
        exclusions: [],
      }),
    );

    const userBAlerts = await prisma.alert.findMany({ where: { userId: fixture.userB } });
    expect(userBAlerts).toHaveLength(0);

    const userAAlerts = await prisma.alert.findMany({ where: { userId: fixture.userA, type: 'renewal' } });
    expect(userAAlerts).toHaveLength(1);
  });
});
