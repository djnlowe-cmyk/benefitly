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
import {
  POST as coveragesPOST,
  PATCH as coveragesPATCH,
} from '@/app/api/coverages/route';
import { POST as familyPOST } from '@/app/api/family/route';
import { PATCH as alertsPATCH } from '@/app/api/alerts/route';
import type { NextRequest } from 'next/server';

let userId = '';
let coverageId = '';

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new Request(url, {
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  const u = await prisma.user.create({
    data: { email: 'validation-user@example.test', name: 'V', passwordHash: 'x' },
  });
  userId = u.id;
  const cov = await prisma.coverage.create({
    data: {
      provider: 'BCBS',
      type: 'Health',
      category: 'health',
      covered: '[]',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      exclusions: '[]',
      userId: u.id,
    },
  });
  coverageId = cov.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/coverages input validation', () => {
  it('rejects coverageLimit as a number with 400 (QA-reported case)', async () => {
    asUser(userId);
    const res = await coveragesPOST(
      jsonRequest('http://localhost/api/coverages', 'POST', {
        provider: 'Aviva',
        type: 'Travel',
        category: 'travel',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        coverageLimit: 5000,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.some((d: { path?: unknown[] }) => Array.isArray(d.path) && d.path.includes('coverageLimit'))).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Prisma|prisma/);
  });

  it('rejects missing required fields with 400', async () => {
    asUser(userId);
    const res = await coveragesPOST(
      jsonRequest('http://localhost/api/coverages', 'POST', {
        type: 'Health',
        category: 'health',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON body with 400', async () => {
    asUser(userId);
    const res = await coveragesPOST(
      jsonRequest('http://localhost/api/coverages', 'POST', '{not json'),
    );
    expect(res.status).toBe(400);
  });

  it('still accepts a valid happy-path payload', async () => {
    asUser(userId);
    const res = await coveragesPOST(
      jsonRequest('http://localhost/api/coverages', 'POST', {
        provider: 'Aviva',
        type: 'Travel',
        category: 'travel',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        coverageLimit: '£5,000',
        premium: 0,
        covered: ['Cancellation'],
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/coverages input validation', () => {
  it('rejects coverageLimit as a number with 400', async () => {
    asUser(userId);
    const res = await coveragesPATCH(
      jsonRequest(`http://localhost/api/coverages?id=${coverageId}`, 'PATCH', {
        coverageLimit: 999,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
  });
});

describe('POST /api/family input validation', () => {
  it('rejects { relationship } instead of { relation } with 400 (QA-reported case)', async () => {
    asUser(userId);
    const res = await familyPOST(
      jsonRequest('http://localhost/api/family', 'POST', {
        name: 'Sam',
        relationship: 'spouse',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
    expect(body.details.some((d: { path?: unknown[] }) => Array.isArray(d.path) && d.path.includes('relation'))).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Prisma|prisma/);
  });

  it('rejects empty name with 400', async () => {
    asUser(userId);
    const res = await familyPOST(
      jsonRequest('http://localhost/api/family', 'POST', {
        name: '',
        relation: 'child',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('still accepts a valid happy-path payload', async () => {
    asUser(userId);
    const res = await familyPOST(
      jsonRequest('http://localhost/api/family', 'POST', {
        name: 'Pat',
        relation: 'spouse',
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/alerts input validation', () => {
  it('rejects missing id with 400', async () => {
    asUser(userId);
    const res = await alertsPATCH(
      jsonRequest('http://localhost/api/alerts', 'PATCH', { read: true }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects non-boolean read with 400', async () => {
    asUser(userId);
    const res = await alertsPATCH(
      jsonRequest('http://localhost/api/alerts', 'PATCH', { id: 'x', read: 'yes' }),
    );
    expect(res.status).toBe(400);
  });
});
