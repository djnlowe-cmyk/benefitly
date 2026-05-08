import { NextResponse } from 'next/server';
import { z, ZodError, type ZodType } from 'zod';

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

// Parse a Request body as JSON and validate against the given schema.
// On any failure (malformed JSON or schema mismatch) returns a structured
// 400 response so handlers never leak Prisma internals via a 500.
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid request', details: [{ message: 'Body must be valid JSON' }] },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

export function validationErrorResponse(err: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid request',
      details: err.issues.map((i) => ({
        path: i.path,
        message: i.message,
        code: i.code,
      })),
    },
    { status: 400 },
  );
}

export { z };
