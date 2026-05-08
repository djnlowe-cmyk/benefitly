import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { POST as coveragesPOST } from '@/app/api/coverages/route';
import { GET as onboardingGET, POST as onboardingPOST } from '@/app/api/onboarding/route';

function asUser(id: string) {
  sessionMock.current = { user: { id } };
}

async function makeFreshUser(email: string) {
  return prisma.user.create({
    data: { email, name: 'Fresh', passwordHash: 'x' },
    select: { id: true, onboardingState: true },
  });
}

function postCoverage() {
  return coveragesPOST(
    new Request('http://localhost/api/coverages', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'Aviva',
        type: 'Home',
        category: 'home',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as import('next/server').NextRequest
  );
}

async function readState(): Promise<string> {
  const res = await onboardingGET();
  const body = (await res.json()) as { state: string };
  return body.state;
}

let counter = 0;
function uniqueEmail() {
  counter += 1;
  return `onboard-${Date.now()}-${counter}@example.test`;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('onboardingState defaults', () => {
  it("new users start in 'fresh'", async () => {
    const user = await makeFreshUser(uniqueEmail());
    expect(user.onboardingState).toBe('fresh');
  });
});

describe('state machine: fresh -> first_save -> done', () => {
  it("flips fresh -> first_save on first coverage POST", async () => {
    const user = await makeFreshUser(uniqueEmail());
    asUser(user.id);

    expect(await readState()).toBe('fresh');

    const res = await postCoverage();
    expect(res.status).toBe(201);

    expect(await readState()).toBe('first_save');
  });

  it("does NOT regress first_save back to fresh on subsequent saves", async () => {
    const user = await makeFreshUser(uniqueEmail());
    asUser(user.id);
    await postCoverage();
    expect(await readState()).toBe('first_save');

    // Subsequent saves while still in first_save must not reset state.
    await postCoverage();
    expect(await readState()).toBe('first_save');
  });

  it("does NOT push done back to first_save on later saves", async () => {
    const user = await makeFreshUser(uniqueEmail());
    asUser(user.id);
    await postCoverage();
    await onboardingPOST();
    expect(await readState()).toBe('done');

    await postCoverage();
    expect(await readState()).toBe('done');
  });
});

describe('dismissal idempotency', () => {
  beforeEach(() => {
    // Each test re-asserts current user; nothing global to reset.
  });

  it('POST /api/onboarding is idempotent — can be called repeatedly without erroring', async () => {
    const user = await makeFreshUser(uniqueEmail());
    asUser(user.id);
    await postCoverage();
    expect(await readState()).toBe('first_save');

    // First dismiss flips to done.
    const r1 = await onboardingPOST();
    expect(r1.status).toBe(200);
    expect(await readState()).toBe('done');

    // Second dismiss (e.g. user clicks the example link after dismissing,
    // or a stale tab fires the same call) is a no-op.
    const r2 = await onboardingPOST();
    expect(r2.status).toBe(200);
    expect(await readState()).toBe('done');

    // Third call from any source still no-ops.
    const r3 = await onboardingPOST();
    expect(r3.status).toBe(200);
    expect(await readState()).toBe('done');
  });

  it('POST /api/onboarding works even when state is already fresh (skips first_save)', async () => {
    const user = await makeFreshUser(uniqueEmail());
    asUser(user.id);
    expect(await readState()).toBe('fresh');

    const res = await onboardingPOST();
    expect(res.status).toBe(200);
    expect(await readState()).toBe('done');
  });

  it("only updates the caller's user row, not someone else's", async () => {
    const a = await makeFreshUser(uniqueEmail());
    const b = await makeFreshUser(uniqueEmail());

    asUser(a.id);
    await postCoverage();
    expect(await readState()).toBe('first_save');

    // User B's state untouched.
    asUser(b.id);
    expect(await readState()).toBe('fresh');

    // B dismisses — A's state still first_save.
    await onboardingPOST();
    expect(await readState()).toBe('done');

    asUser(a.id);
    expect(await readState()).toBe('first_save');
  });
});

describe('unauthenticated /api/onboarding', () => {
  it('returns 401 when there is no session', async () => {
    sessionMock.current = null;
    expect((await onboardingGET()).status).toBe(401);
    expect((await onboardingPOST()).status).toBe(401);
  });
});
