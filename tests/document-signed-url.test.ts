import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { GET as urlGET } from '@/app/api/documents/[id]/url/route';
import { GET as contentGET } from '@/app/api/documents/[id]/content/route';
import {
  __setDocumentStorageForTests,
  type DocumentStorage,
} from '@/lib/storage';
import type { NextRequest } from 'next/server';

function asUser(id: string | null) {
  sessionMock.current = id ? { user: { id } } : null;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getReq(path = 'http://localhost/x'): NextRequest {
  return new Request(path) as unknown as NextRequest;
}

const fixture = {
  userA: '',
  userB: '',
  docA: '',
  docB: '',
};

let mockStore: Map<string, { body: Buffer; contentType: string | null }>;
let putCalls: Array<{ userId: string; filename: string; contentType: string }>;
let delCalls: string[];
let restore: () => void;

beforeAll(async () => {
  process.env.AUTH_SECRET ||= 'test-secret-not-for-production';

  const a = await prisma.user.create({
    data: { email: 'doc-alice@example.test', name: 'Alice', passwordHash: 'x' },
  });
  const b = await prisma.user.create({
    data: { email: 'doc-bob@example.test', name: 'Bob', passwordHash: 'x' },
  });
  fixture.userA = a.id;
  fixture.userB = b.id;
});

beforeEach(async () => {
  await prisma.documentAccessLog.deleteMany({});
  await prisma.document.deleteMany({});

  // Each test gets a clean in-memory storage backend so re-key behaviour is
  // observable without hitting Vercel.
  mockStore = new Map();
  putCalls = [];
  delCalls = [];
  const impl: DocumentStorage = {
    async put({ userId, filename, contentType, body }) {
      putCalls.push({ userId, filename, contentType });
      const key = `users/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;
      mockStore.set(key, { body, contentType });
      return { storagePath: key };
    },
    async get(storagePath) {
      const v = mockStore.get(storagePath);
      if (!v) throw new Error(`mock: not found ${storagePath}`);
      return v;
    },
    async del(storagePath) {
      delCalls.push(storagePath);
      mockStore.delete(storagePath);
    },
  };
  restore = __setDocumentStorageForTests(impl);

  const docA = await prisma.document.create({
    data: {
      filename: 'policy-a.pdf',
      mimeType: 'application/pdf',
      size: 4,
      storagePath: 'users/alice/initial-private-key',
      userId: fixture.userA,
    },
  });
  mockStore.set(docA.storagePath, {
    body: Buffer.from('AAAA'),
    contentType: 'application/pdf',
  });
  fixture.docA = docA.id;

  const docB = await prisma.document.create({
    data: {
      filename: 'policy-b.pdf',
      mimeType: 'application/pdf',
      size: 4,
      storagePath: 'users/bob/initial-private-key',
      userId: fixture.userB,
    },
  });
  mockStore.set(docB.storagePath, {
    body: Buffer.from('BBBB'),
    contentType: 'application/pdf',
  });
  fixture.docB = docB.id;
});

afterEach(() => {
  restore?.();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/documents/[id]/url', () => {
  it('returns 401 when unauthenticated', async () => {
    asUser(null);
    const res = await urlGET(getReq(), ctx(fixture.docA));
    expect(res.status).toBe(401);
  });

  it('returns 404 when fetching another user\'s document (no existence leak)', async () => {
    asUser(fixture.userA);
    const res = await urlGET(getReq(), ctx(fixture.docB));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the document does not exist', async () => {
    asUser(fixture.userA);
    const res = await urlGET(getReq(), ctx('nonexistent-id'));
    expect(res.status).toBe(404);
  });

  it('owner can mint a short-lived signed URL with expiry ≤ 5 min', async () => {
    asUser(fixture.userA);
    const before = Date.now();
    const res = await urlGET(getReq(), ctx(fixture.docA));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(
      new RegExp(`^/api/documents/${fixture.docA}/content\\?token=`),
    );
    expect(body.filename).toBe('policy-a.pdf');
    expect(body.mimeType).toBe('application/pdf');
    const expMs = new Date(body.expiresAt).getTime();
    expect(expMs - before).toBeGreaterThan(0);
    // ≤ 5 min from "now". Allow 1s of fuzz for the assertion clock.
    expect(expMs - before).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
    expect(body.ttlSeconds).toBeLessThanOrEqual(300);
  });

  it('writes a DocumentAccessLog row with mode=signed_url on each grant', async () => {
    asUser(fixture.userA);
    await urlGET(getReq(), ctx(fixture.docA));
    const logs = await prisma.documentAccessLog.findMany({
      where: { documentId: fixture.docA, userId: fixture.userA },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].mode).toBe('signed_url');
  });

  it('lazily re-keys a legacy public-URL document on first signed-URL request', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'fake-test-token';
    const oldUrl = 'https://blob.example.com/users/alice/legacy.pdf';
    const legacy = await prisma.document.create({
      data: {
        filename: 'legacy.pdf',
        mimeType: 'application/pdf',
        size: 4,
        storagePath: oldUrl,
        userId: fixture.userA,
      },
    });
    mockStore.set(oldUrl, {
      body: Buffer.from('LEGA'),
      contentType: 'application/pdf',
    });

    asUser(fixture.userA);
    const res = await urlGET(getReq(), ctx(legacy.id));
    expect(res.status).toBe(200);

    const after = await prisma.document.findUnique({ where: { id: legacy.id } });
    expect(after?.storagePath).not.toBe(oldUrl);
    expect(after?.storagePath).not.toMatch(/^https?:/);

    // Old public blob deleted exactly once.
    expect(delCalls.filter((p) => p === oldUrl)).toHaveLength(1);

    // One re-key audit row plus one signed_url audit row.
    const logs = await prisma.documentAccessLog.findMany({
      where: { documentId: legacy.id },
      orderBy: { grantedAt: 'asc' },
    });
    expect(logs.map((l) => l.mode)).toEqual(['rekey', 'signed_url']);

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
});

describe('GET /api/documents/[id]/content', () => {
  it('streams bytes when given a valid token, writes proxy audit log', async () => {
    asUser(fixture.userA);
    const urlRes = await urlGET(getReq(), ctx(fixture.docA));
    const { url } = await urlRes.json();
    asUser(null); // token must work without a session cookie.

    const contentRes = await contentGET(
      getReq(`http://localhost${url}`),
      ctx(fixture.docA),
    );
    expect(contentRes.status).toBe(200);
    const buf = Buffer.from(await contentRes.arrayBuffer());
    expect(buf.toString()).toBe('AAAA');
    expect(contentRes.headers.get('content-type')).toBe('application/pdf');
    expect(contentRes.headers.get('content-disposition')).toMatch(/inline; filename=/);

    const proxyLogs = await prisma.documentAccessLog.findMany({
      where: { documentId: fixture.docA, mode: 'proxy' },
    });
    expect(proxyLogs).toHaveLength(1);
  });

  it('rejects a token whose documentId does not match the path', async () => {
    asUser(fixture.userA);
    const urlRes = await urlGET(getReq(), ctx(fixture.docA));
    const { url } = await urlRes.json();
    const tokenMatch = url.match(/token=([^&]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    asUser(null);
    const res = await contentGET(
      getReq(`http://localhost/api/documents/${fixture.docB}/content?token=${token}`),
      ctx(fixture.docB),
    );
    expect(res.status).toBe(403);
  });

  it('rejects a tampered token', async () => {
    asUser(fixture.userA);
    const urlRes = await urlGET(getReq(), ctx(fixture.docA));
    const { url } = await urlRes.json();
    const tampered = url.replace(/token=([^&]+)/, 'token=$1AAA');
    asUser(null);
    const res = await contentGET(
      getReq(`http://localhost${tampered}`),
      ctx(fixture.docA),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when called with no token and no session', async () => {
    asUser(null);
    const res = await contentGET(getReq(), ctx(fixture.docA));
    expect(res.status).toBe(401);
  });

  it('returns 404 when called with a session but for another user\'s doc', async () => {
    asUser(fixture.userA);
    const res = await contentGET(getReq(), ctx(fixture.docB));
    expect(res.status).toBe(404);
  });
});
