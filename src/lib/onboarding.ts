// Persisted on User.onboardingState as a JSON string. Each flag flips to true
// the first time the matching surface is shown so we never re-prompt a user.
export const ONBOARDING_FLAGS = ['seenEmptyState', 'seenPostSavePrompt'] as const;
export type OnboardingFlag = (typeof ONBOARDING_FLAGS)[number];
export type OnboardingState = Partial<Record<OnboardingFlag, boolean>>;

export function parseOnboardingState(raw: string | null | undefined): OnboardingState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: OnboardingState = {};
    for (const flag of ONBOARDING_FLAGS) {
      if ((parsed as Record<string, unknown>)[flag] === true) out[flag] = true;
    }
    return out;
  } catch {
    return {};
  }
}
