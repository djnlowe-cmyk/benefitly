import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { markOnboardingDone, normaliseOnboardingState } from '@/lib/onboarding';

export async function GET() {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { onboardingState: true },
  });

  return NextResponse.json({
    state: normaliseOnboardingState(user?.onboardingState),
  });
}

// POST marks the user `done`. Used by both the dismiss button and the
// example-search click — the second call is a no-op.
export async function POST() {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  await markOnboardingDone(session.userId);

  return NextResponse.json({ state: 'done' });
}
