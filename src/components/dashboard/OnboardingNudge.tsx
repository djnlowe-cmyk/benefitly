'use client';

export const ONBOARDING_EXAMPLE_QUERY = "What's the excess on my policy?";

interface OnboardingNudgeProps {
  // Both buttons flip onboardingState to `done` via this callback. The
  // example button additionally navigates to /search?q=… (handled by the
  // anchor's href, which goes through Next routing); dismiss does not nav.
  onDone: () => void;
}

export default function OnboardingNudge({ onDone }: OnboardingNudgeProps) {
  const exampleHref = `/search?q=${encodeURIComponent(ONBOARDING_EXAMPLE_QUERY)}`;

  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 flex items-start justify-between gap-4"
      role="region"
      aria-label="Onboarding nudge"
    >
      <div>
        <div className="text-sm font-semibold text-blue-900 mb-1">
          Try asking a question about your cover.
        </div>
        <a
          href={exampleHref}
          onClick={onDone}
          className="inline-block px-3 py-1.5 bg-blue-600 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-700 no-underline"
        >
          {ONBOARDING_EXAMPLE_QUERY}
        </a>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="px-3 py-1.5 bg-white border border-blue-300 rounded-md text-xs font-semibold text-blue-700 cursor-pointer hover:bg-blue-100"
      >
        Got it
      </button>
    </div>
  );
}
