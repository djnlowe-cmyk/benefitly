import { describe, expect, it } from 'vitest';
import { scrubEvent, type ScrubbableEvent } from '@/lib/sentryScrubber';

describe('scrubEvent', () => {
  it('strips cookies, auth headers, body, and clears query string', () => {
    const event: ScrubbableEvent = {
      request: {
        cookies: { session: 'abc' },
        headers: {
          cookie: 'session=abc',
          authorization: 'Bearer leaky',
          Authorization: 'Bearer leaky2',
          'user-agent': 'vitest',
        },
        data: { password: 'x' },
        query_string: 'q=secret',
      },
    };

    const out = scrubEvent(event);

    expect(out.request).toBeDefined();
    const req = out.request!;

    // Strip the four sensitive request fields entirely.
    expect(req.cookies).toBeUndefined();
    expect(req.data).toBeUndefined();
    expect(req.headers).toBeDefined();
    expect(req.headers!.cookie).toBeUndefined();
    expect(req.headers!.authorization).toBeUndefined();
    expect((req.headers as Record<string, unknown>).Authorization).toBeUndefined();

    // Clear (not delete) query_string so analyses still see "no query".
    expect(req.query_string).toBe('');

    // Innocent headers survive.
    expect(req.headers!['user-agent']).toBe('vitest');
  });

  it('is a no-op when request is absent', () => {
    const event: ScrubbableEvent = { extra: 'data' };
    const out = scrubEvent(event);
    expect(out).toBe(event);
    expect(out.request).toBeUndefined();
  });
});
