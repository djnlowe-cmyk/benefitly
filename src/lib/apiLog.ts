import type { NextResponse } from 'next/server';

// Structured access logging for API route handlers.
//
// Wraps a handler so every invocation emits exactly one JSON log line on
// completion (success or thrown). Sentry's existing instrumentation catches
// the throw — we just re-throw and let it report.
//
// Body, cookies, query strings, and headers are intentionally NOT logged.
// Only safe metadata: route, method, status, durationMs, requestId, userId.

interface ApiLogEntry {
  ts: string;
  requestId: string;
  userId: string | null;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  level: 'info';
}

interface WithApiLoggingOptions {
  route: string;
}

type RouteHandler<Req extends Request, Args extends unknown[]> = (
  req: Req,
  ...rest: Args
) => Promise<Response> | Response;

// Per-request slot for the userId. WeakMap keys off the Request object so
// concurrent requests can't see each other's user. The wrapper reads the
// slot when emitting the log line.
const requestUserId = new WeakMap<Request, string>();

export function setRequestUserId(req: Request, userId: string): void {
  requestUserId.set(req, userId);
}

export function withApiLogging<Req extends Request, Args extends unknown[]>(
  handler: RouteHandler<Req, Args>,
  options: WithApiLoggingOptions,
): RouteHandler<Req, Args> {
  return async (req, ...rest) => {
    const requestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const start = Date.now();
    const method = req.method;

    const emit = (status: number) => {
      const entry: ApiLogEntry = {
        ts: new Date().toISOString(),
        requestId,
        userId: requestUserId.get(req) ?? null,
        route: options.route,
        method,
        status,
        durationMs: Date.now() - start,
        level: 'info',
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
    };

    try {
      const response = (await handler(req, ...rest)) as Response | NextResponse;
      emit(response.status);
      return response;
    } catch (err) {
      emit(500);
      throw err;
    }
  };
}
