import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

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
import { GET as alertsGET } from '@/app/api/alerts/route';

type Fixture = {
  userA: string;
  userB: string;
};

const fixture: Partial<Fixture> = {};

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

function postCoverage(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/coverages', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

function patchCoverage(id: string, body: Record<string, unknown>): NextRequest {
  return new Request(`http://localhost/api/coverages?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  const userA = await prisma.user.create({
    data: { email: 'renewal-a@example.test', name: 'Renewal A', passwordHash: 'x' },
  });
  const userB = await prisma.user.create({
    data: { email: 'renewal-b@example.test', name: 'Renewal B', passwordHash: 'x' },
  });
  fixture.userA = userA.id;
  fixture.userB = userB.id;
});

beforeEach(async () => {
  // Each test starts with no coverages or alerts for the renewal users.
  await prisma.alert.deleteMany({ where: { userId: { in: [fixture.userA!, fixture.userB!] } } });
  await prisma.coverage.deleteMany({ where: { userId: { in: [fixture.userA!, fixture.userB!] } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function coverageBody(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'Aviva',
    type: 'Auto',
    category: 'car',
    startDate: '2026-01-01',
    endDate: daysFromNow(14),
    ...overrides,
  };
}

describe('renewal alert on coverage save', () => {
  it('POST with endDate 14d out creates one renewal alert with the UK-formatted title', async () => {
    asUser(fixture.userA!);
    const endDate = daysFromNow(14);
    const res = await coveragesPOST(postCoverage(coverageBody({ endDate })));
    expect(res.status).toBe(201);
    const created = await res.json();

    const alerts = await prisma.alert.findMany({
      where: { coverageId: created.id, type: 'renewal' },
    });
    expect(alerts).toHaveLength(1);
    const [alert] = alerts;
    const expectedDate = endDate.split('-').reverse().join('/'); // YYYY-MM-DD -> DD/MM/YYYY
    expect(alert.title).toBe(`Renewal — Aviva car expires ${expectedDate}`);
    expect(alert.detail).toBe(
      `Your Aviva car policy expires on ${expectedDate}. Renew or replace before then.`,
    );
    expect(alert.severity).toBe('warning');
    expect(alert.read).toBe(false);
    expect(alert.userId).toBe(fixture.userA);
    expect(alert.coverageId).toBe(created.id);
    expect(alert.date).toBe(endDate);
  });

  it('POST with endDate 60d out creates no renewal alert', async () => {
    asUser(fixture.userA!);
    const res = await coveragesPOST(postCoverage(coverageBody({ endDate: daysFromNow(60) })));
    expect(res.status).toBe(201);
    const created = await res.json();

    const alerts = await prisma.alert.findMany({
      where: { coverageId: created.id, type: 'renewal' },
    });
    expect(alerts).toHaveLength(0);
  });

  it('POST with endDate already in the past creates no renewal alert', async () => {
    asUser(fixture.userA!);
    const res = await coveragesPOST(postCoverage(coverageBody({ endDate: daysFromNow(-7) })));
    expect(res.status).toBe(201);
    const created = await res.json();

    const alerts = await prisma.alert.findMany({
      where: { coverageId: created.id, type: 'renewal' },
    });
    expect(alerts).toHaveLength(0);
  });

  it('PATCH that does not include endDate does not create a duplicate alert', async () => {
    asUser(fixture.userA!);
    const created = await (
      await coveragesPOST(postCoverage(coverageBody({ endDate: daysFromNow(14) })))
    ).json();
    expect(
      await prisma.alert.count({ where: { coverageId: created.id, type: 'renewal' } }),
    ).toBe(1);

    const patchRes = await coveragesPATCH(patchCoverage(created.id, { provider: 'Aviva PLC' }));
    expect(patchRes.status).toBe(200);

    const total = await prisma.alert.count({
      where: { coverageId: created.id, type: 'renewal' },
    });
    expect(total).toBe(1);
  });

  it('PATCH that re-sets the same in-window endDate is idempotent', async () => {
    asUser(fixture.userA!);
    const endDate = daysFromNow(14);
    const created = await (await coveragesPOST(postCoverage(coverageBody({ endDate })))).json();
    expect(
      await prisma.alert.count({ where: { coverageId: created.id, type: 'renewal' } }),
    ).toBe(1);

    const patchRes = await coveragesPATCH(patchCoverage(created.id, { endDate }));
    expect(patchRes.status).toBe(200);

    const total = await prisma.alert.count({
      where: { coverageId: created.id, type: 'renewal' },
    });
    expect(total).toBe(1);
  });

  it('PATCH that pulls endDate from 60d into 14d creates the alert', async () => {
    asUser(fixture.userA!);
    const created = await (
      await coveragesPOST(postCoverage(coverageBody({ endDate: daysFromNow(60) })))
    ).json();
    expect(
      await prisma.alert.count({ where: { coverageId: created.id, type: 'renewal' } }),
    ).toBe(0);

    const patchRes = await coveragesPATCH(
      patchCoverage(created.id, { endDate: daysFromNow(14) }),
    );
    expect(patchRes.status).toBe(200);

    const total = await prisma.alert.count({
      where: { coverageId: created.id, type: 'renewal' },
    });
    expect(total).toBe(1);
  });

  it('renewal alerts are isolated to the owning user', async () => {
    asUser(fixture.userA!);
    const aCreated = await (
      await coveragesPOST(
        postCoverage(coverageBody({ provider: 'Aviva', endDate: daysFromNow(14) })),
      )
    ).json();

    asUser(fixture.userB!);
    const bCreated = await (
      await coveragesPOST(
        postCoverage(coverageBody({ provider: 'Direct Line', endDate: daysFromNow(14) })),
      )
    ).json();

    asUser(fixture.userA!);
    const aAlerts = await (await alertsGET()).json();
    const aAlertCoverageIds = aAlerts.map((r: { coverageId: string | null }) => r.coverageId);
    expect(aAlertCoverageIds).toContain(aCreated.id);
    expect(aAlertCoverageIds).not.toContain(bCreated.id);

    asUser(fixture.userB!);
    const bAlerts = await (await alertsGET()).json();
    const bAlertCoverageIds = bAlerts.map((r: { coverageId: string | null }) => r.coverageId);
    expect(bAlertCoverageIds).toContain(bCreated.id);
    expect(bAlertCoverageIds).not.toContain(aCreated.id);
  });
});
