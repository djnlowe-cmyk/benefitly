import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { ONBOARDING_FLAGS, parseOnboardingState, type OnboardingState } from '@/lib/onboarding';

export async function GET() {
  const session = await requireUserId();
  if (!session.ok) return session.response;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, country: true, currency: true, onboardingState: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    country: user.country,
    currency: user.currency,
    onboardingState: parseOnboardingState(user.onboardingState),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const body = (await req.json().catch(() => null)) as { onboardingState?: Partial<OnboardingState> } | null;
  const patch = body?.onboardingState;
  if (!patch || typeof patch !== 'object') {
    return NextResponse.json({ error: 'onboardingState is required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { onboardingState: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const current = parseOnboardingState(existing.onboardingState);
  const next: OnboardingState = { ...current };
  for (const flag of ONBOARDING_FLAGS) {
    if (patch[flag] === true) next[flag] = true;
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { onboardingState: JSON.stringify(next) },
  });

  return NextResponse.json({ onboardingState: next });
}
