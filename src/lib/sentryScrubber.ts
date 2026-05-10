// Shared Sentry beforeSend scrubber. Strips request fields that can carry
// session tokens, auth headers, password bodies, or query secrets so they
// never land in the Sentry event store.
//
// Used by sentry.{client,server,edge}.config.ts and exercised directly by
// tests/sentry-scrubber.test.ts.

type SentryRequest = {
  cookies?: unknown;
  headers?: Record<string, unknown>;
  data?: unknown;
  query_string?: unknown;
};

export interface ScrubbableEvent {
  request?: SentryRequest;
  [key: string]: unknown;
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const request = event.request;
  if (!request) return event;

  delete request.cookies;
  delete request.data;
  request.query_string = '';

  if (request.headers && typeof request.headers === 'object') {
    for (const key of Object.keys(request.headers)) {
      const lower = key.toLowerCase();
      if (lower === 'cookie' || lower === 'authorization') {
        delete request.headers[key];
      }
    }
  }

  return event;
}
