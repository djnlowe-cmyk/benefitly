import prisma from '@/lib/db';

export type OnboardingState = 'fresh' | 'first_save' | 'done';

const FORWARD: Record<OnboardingState, OnboardingState[]> = {
  fresh: ['first_save', 'done'],
  first_save: ['done'],
  done: [],
};

function isOnboardingState(value: unknown): value is OnboardingState {
  return value === 'fresh' || value === 'first_save' || value === 'done';
}

export function normaliseOnboardingState(value: unknown): OnboardingState {
  return isOnboardingState(value) ? value : 'fresh';
}

// Conditional update: only writes if the user is currently in `from` state.
// `to` must be reachable forward from `from` (no resets via this helper).
// Returns the row count updated — 0 means the transition was a no-op
// (state already advanced or user not found), which makes both calls
// (first-save flip and dismiss/example-click) safely idempotent.
export async function advanceOnboardingState(
  userId: string,
  from: OnboardingState,
  to: OnboardingState
): Promise<number> {
  if (!FORWARD[from].includes(to)) return 0;
  const result = await prisma.user.updateMany({
    where: { id: userId, onboardingState: from },
    data: { onboardingState: to },
  });
  return result.count;
}

// Idempotent: marks the user `done` from any earlier state. Used by both
// the dismiss button and the example-search click.
export async function markOnboardingDone(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, onboardingState: { in: ['fresh', 'first_save'] } },
    data: { onboardingState: 'done' },
  });
}
