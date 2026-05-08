import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; gapKey: string }>;
}

const VALID_REASONS = new Set(['have_elsewhere', 'not_relevant']);

export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id, gapKey } = await ctx.params;
  if (!id || !gapKey) {
    return NextResponse.json({ error: 'Missing path params' }, { status: 400 });
  }

  // Decode the percent-encoded path segment so the stored gapKey matches
  // the engine's literal output (e.g. "exclusion:flood").
  const decodedGapKey = decodeURIComponent(gapKey);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const reason = (body as { reason?: unknown } | null)?.reason;
  if (typeof reason !== 'string' || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  // Ownership check — never trust the path id alone. Same pattern as the
  // existing list-route PATCH/DELETE.
  const coverage = await prisma.coverage.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!coverage) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const dismissal = await prisma.coverageGapDismissal.upsert({
    where: {
      userId_coverageId_gapKey: {
        userId: session.userId,
        coverageId: id,
        gapKey: decodedGapKey,
      },
    },
    create: {
      userId: session.userId,
      coverageId: id,
      gapKey: decodedGapKey,
      dismissReason: reason,
    },
    update: {
      dismissReason: reason,
    },
  });

  console.log(`[gap_dismissed] coverageId=${id} gapKey=${decodedGapKey} reason=${reason}`);

  return NextResponse.json({
    id: dismissal.id,
    coverageId: dismissal.coverageId,
    gapKey: dismissal.gapKey,
    dismissReason: dismissal.dismissReason,
    dismissedAt: dismissal.dismissedAt.toISOString(),
  });
}
