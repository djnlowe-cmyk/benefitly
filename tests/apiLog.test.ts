import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withApiLogging, setRequestUserId } from '@/lib/apiLog';

interface ApiLogShape {
  ts: string;
  requestId: string;
  userId: string | null;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  level: 'info';
}

const SECRET = 'super-secret-password';
const SENSITIVE_QUERY = 'token=leaky';

describe('withApiLogging', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits one JSON log line with the right shape and no body/cookie/query content', async () => {
    const handler = withApiLogging(
      async (req: Request) => {
        // Route would normally call setRequestUserId after requireUserId().
        setRequestUserId(req, 'user_123');
        // Touch the body so the test mirrors a real handler reading it.
        await req.json();
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      },
      { route: 'test.route' },
    );

    const req = new Request(`https://example.test/api/things?${SENSITIVE_QUERY}`, {
      method: 'POST',
      headers: {
        cookie: 'session=abc',
        authorization: 'Bearer leaky',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ password: SECRET }),
    });

    const res = await handler(req);
    expect(res.status).toBe(201);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const raw = logSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw) as ApiLogShape;

    // Shape — all required fields present, types correct.
    expect(entry.level).toBe('info');
    expect(entry.route).toBe('test.route');
    expect(entry.method).toBe('POST');
    expect(entry.status).toBe(201);
    expect(entry.userId).toBe('user_123');
    expect(typeof entry.requestId).toBe('string');
    expect(entry.requestId.length).toBeGreaterThan(0);
    expect(typeof entry.durationMs).toBe('number');
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof entry.ts).toBe('string');
    expect(() => new Date(entry.ts).toISOString()).not.toThrow();

    // No body / cookie / auth header / query content in the log line.
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('cookie');
    expect(raw).not.toContain('Cookie');
    expect(raw).not.toContain('authorization');
    expect(raw).not.toContain('Authorization');
    expect(raw).not.toContain('Bearer');
    expect(raw).not.toContain('token=leaky');
    expect(raw).not.toContain(SENSITIVE_QUERY);
  });

  it('logs status 500 and re-throws so Sentry can capture', async () => {
    const handler = withApiLogging(
      async () => {
        throw new Error('boom');
      },
      { route: 'test.throws' },
    );

    const req = new Request('https://example.test/api/throws', { method: 'GET' });

    await expect(handler(req)).rejects.toThrow('boom');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string) as ApiLogShape;
    expect(entry.status).toBe(500);
    expect(entry.route).toBe('test.throws');
    expect(entry.userId).toBeNull();
  });

  it('logs userId as null when setRequestUserId is not called', async () => {
    const handler = withApiLogging(
      async () => new Response(null, { status: 204 }),
      { route: 'test.anon' },
    );

    const req = new Request('https://example.test/api/anon', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(204);

    const entry = JSON.parse(logSpy.mock.calls[0][0] as string) as ApiLogShape;
    expect(entry.userId).toBeNull();
  });
});
