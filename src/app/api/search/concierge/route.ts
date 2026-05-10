import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { withApiLogging, setRequestUserId } from '@/lib/apiLog';

const QUERY_MAX = 500;
const EXPECTED_MAX = 2_000;

export const POST = withApiLogging(async (req: NextRequest) => {
  const session = await requireUserId();
  if (!session.ok) return session.response;
  setRequestUserId(req, session.userId);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const rawQuery = (body as { query?: unknown } | null)?.query;
  const rawExpected = (body as { expectedAnswer?: unknown } | null)?.expectedAnswer;

  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }
  if (query.length > QUERY_MAX) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 });
  }

  let expectedAnswer: string | null = null;
  if (typeof rawExpected === 'string') {
    const trimmed = rawExpected.trim();
    if (trimmed.length > EXPECTED_MAX) {
      return NextResponse.json({ error: 'expectedAnswer too long' }, { status: 400 });
    }
    expectedAnswer = trimmed.length > 0 ? trimmed : null;
  }

  await prisma.conciergeQuery.create({
    data: {
      userId: session.userId,
      query,
      expectedAnswer,
    },
  });

  return NextResponse.json({ ok: true });
}, { route: 'search.concierge' });
