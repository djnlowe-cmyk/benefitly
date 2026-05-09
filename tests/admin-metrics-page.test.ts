import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const sessionMock = vi.hoisted(() => ({
  current: null as { user: { id: string; email: string } } | null,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => sessionMock.current,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import prisma from '@/lib/db';
import AdminGapsMetricsPage from '@/app/admin/metrics/gaps/page';
import { requireAdmin } from '@/lib/admin';

const ADMIN_EMAIL = 'admin@example.test';
const USER_EMAIL = 'user@example.test';

function asUser(id: string, email: string) {
  sessionMock.current = { user: { id, email } };
}

function asAnonymous() {
  sessionMock.current = null;
}

function digestStatus(err: unknown): number | null {
  if (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string'
  ) {
    const parts = (err as { digest: string }).digest.split(';');
    if (parts[0] === 'NEXT_HTTP_ERROR_FALLBACK') return Number(parts[1]);
  }
  return null;
}

let adminId = '';
let userId = '';

beforeAll(async () => {
  process.env.ADMIN_USER_EMAILS = `${ADMIN_EMAIL},someone-else@example.test`;
  const admin = await prisma.user.create({
    data: { email: ADMIN_EMAIL, name: 'Admin', passwordHash: 'x' },
  });
  const user = await prisma.user.create({
    data: { email: USER_EMAIL, name: 'User', passwordHash: 'x' },
  });
  adminId = admin.id;
  userId = user.id;

  // Seed: one fire (1 coverage with flood exclusion) + one dismissal +
  // two distinct detail-view users so the engagement ratio is non-zero.
  const cov = await prisma.coverage.create({
    data: {
      provider: 'Aviva',
      type: 'Home contents',
      category: 'home',
      covered: JSON.stringify([]),
      exclusions: JSON.stringify(['Flood damage']),
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      userId: userId,
    },
  });
  await prisma.coverageDetailView.createMany({
    data: [
      { userId: userId, coverageId: cov.id, firedGapCount: 1 },
      { userId: adminId, coverageId: cov.id, firedGapCount: 1 },
    ],
  });
  await prisma.coverageGapDismissal.create({
    data: {
      userId: userId,
      coverageId: cov.id,
      gapKey: 'exclusion:flood',
      dismissReason: 'have_elsewhere',
    },
  });
});

beforeEach(() => {
  asAnonymous();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('requireAdmin()', () => {
  it('throws unauthorized (401) for anonymous callers', async () => {
    asAnonymous();
    let caught: unknown;
    try {
      await requireAdmin();
    } catch (err) {
      caught = err;
    }
    expect(digestStatus(caught)).toBe(401);
  });

  it('throws notFound (404) for authed non-admin callers', async () => {
    asUser(userId, USER_EMAIL);
    let caught: unknown;
    try {
      await requireAdmin();
    } catch (err) {
      caught = err;
    }
    expect(digestStatus(caught)).toBe(404);
  });

  it('returns the admin session when the email is allowlisted', async () => {
    asUser(adminId, ADMIN_EMAIL);
    const session = await requireAdmin();
    expect(session.userId).toBe(adminId);
    expect(session.email).toBe(ADMIN_EMAIL);
  });
});

describe('GET /admin/metrics/gaps (server component)', () => {
  it('refuses non-admin callers with a 404 navigation error', async () => {
    asUser(userId, USER_EMAIL);
    let caught: unknown;
    try {
      await AdminGapsMetricsPage();
    } catch (err) {
      caught = err;
    }
    expect(digestStatus(caught)).toBe(404);
  });

  it('refuses anonymous callers with a 401 navigation error', async () => {
    asAnonymous();
    let caught: unknown;
    try {
      await AdminGapsMetricsPage();
    } catch (err) {
      caught = err;
    }
    expect(digestStatus(caught)).toBe(401);
  });

  it('renders the four cuts as HTML for admin callers', async () => {
    asUser(adminId, ADMIN_EMAIL);
    const tree = await AdminGapsMetricsPage();
    const html = renderToStaticMarkup(tree);

    // Section headers for the four cuts.
    expect(html).toContain('Engagement');
    expect(html).toContain('Fire snapshot');
    expect(html).toContain('Dismissals by reason');
    expect(html).toContain('Per-rule dismissal rate');

    // Seeded fire row shows up.
    expect(html).toContain('exclusion:flood');
    // Seeded dismissal reason shows up.
    expect(html).toContain('have_elsewhere');
    // Footer caveat is present.
    expect(html).toContain('v1 = dismissal-only signal');
  });
});
