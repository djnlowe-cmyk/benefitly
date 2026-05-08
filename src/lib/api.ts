// Tiny typed fetch helper used by client components to call our /api routes.
// Centralises JSON parsing, status checking, error messages, and AbortSignal
// plumbing so call sites stay uniform.

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  // For non-GET calls, pass a JSON-serialisable body — apiFetch sets the
  // Content-Type header and stringifies for you. Pass `raw` (e.g. FormData)
  // when you need to bypass JSON serialisation.
  json?: unknown;
  raw?: BodyInit;
}

export async function apiFetch<T>(url: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { json, raw, headers, ...rest } = opts;

  const init: RequestInit = { ...rest };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers = { 'Content-Type': 'application/json', ...(headers || {}) };
  } else if (raw !== undefined) {
    init.body = raw;
    if (headers) init.headers = headers;
  } else if (headers) {
    init.headers = headers;
  }

  const res = await fetch(url, init);

  let payload: unknown = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}
