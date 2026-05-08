import type { CoverageCategory } from '@/types/coverage';

// Example questions per category for the post-save nudge. Each prompt is
// crafted to actually return at least one match against a coverage of that
// category, so a brand-new user gets a useful answer on their first search.
const EXAMPLES: Record<CoverageCategory, string> = {
  health: 'Am I covered for a knee MRI?',
  dental: 'Is a root canal covered?',
  vision: 'Are new glasses covered?',
  life: 'What does my life policy pay out?',
  disability: 'Am I covered if I cannot work for 3 months?',
  auto: 'I was in a car accident — what do I do?',
  home: 'A pipe burst at home — am I covered?',
  travel: 'Am I covered for travel cancellation?',
  pet: 'Is my pet covered for surgery?',
  warranty: 'My laptop screen cracked — is that covered?',
  creditcard: 'Did my card cover a faulty purchase under Section 75?',
  business: 'Am I covered if a client threatens a lawsuit?',
};

const FALLBACK = 'What am I covered for?';

export function exampleQuestionForCategory(category: string | undefined): string {
  if (!category) return FALLBACK;
  return EXAMPLES[category as CoverageCategory] ?? FALLBACK;
}
