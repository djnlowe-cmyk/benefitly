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
import { GET as meGET, PATCH as mePATCH } from '@/app/api/me/route';
import type { NextRequest } from 'next/server';

function asUser(id: string | null) {
  sessionMock.current = id ? { user: { id } } : null;
}

function patchRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

const fixture = { userId: '' };

beforeAll(async () => {
  const u = await prisma.user.create({
    data: {
      email: 'onboarding-test@example.test',
      name: 'Newbie',
      passwordHash: 'x',
      country: 'GB',
      currency: 'GBP',
    },
  });
  fixture.userId = u.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'onboarding-test@example.test' } });
});

describe('/api/me onboardingState', () => {
  it('returns {} for a brand-new user', async () => {
    asUser(fixture.userId);
    const res = await meGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboardingState).toEqual({});
  });

  it('rejects unauthenticated callers', async () => {
    asUser(null);
    const res = await meGET();
    expect(res.status).toBe(401);
  });

  it('persists a flag set to true', async () => {
    asUser(fixture.userId);
    const res = await mePATCH(patchRequest({ onboardingState: { seenEmptyState: true } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboardingState).toEqual({ seenEmptyState: true });

    const reread = await meGET();
    const rereadBody = await reread.json();
    expect(rereadBody.onboardingState).toEqual({ seenEmptyState: true });
  });

  it('merges new flags with previously-set flags (never clears)', async () => {
    asUser(fixture.userId);
    const res = await mePATCH(patchRequest({ onboardingState: { seenPostSavePrompt: true } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboardingState).toEqual({
      seenEmptyState: true,
      seenPostSavePrompt: true,
    });
  });

  it('ignores unknown flags', async () => {
    asUser(fixture.userId);
    const res = await mePATCH(
      patchRequest({ onboardingState: { somethingElse: true, seenEmptyState: true } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboardingState.somethingElse).toBeUndefined();
  });

  it('rejects setting a flag to false (one-way only)', async () => {
    asUser(fixture.userId);
    const res = await mePATCH(patchRequest({ onboardingState: { seenEmptyState: false } }));
    const body = await res.json();
    expect(body.onboardingState.seenEmptyState).toBe(true);
  });

  it('rejects malformed body', async () => {
    asUser(fixture.userId);
    const res = await mePATCH(patchRequest({ wrong: 'shape' }));
    expect(res.status).toBe(400);
  });
});
