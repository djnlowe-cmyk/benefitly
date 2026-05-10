// Document-extraction prompt for Benefitly's parse pipeline. Bumped whenever
// the prompt text changes so the parse-quality benchmark (bench/run.ts) can
// detect prompt drift and warn about cross-version comparisons.

export const PARSE_PROMPT_VERSION = '2026-05-10.v1';

export function buildExtractionPrompt(country: string, currency: string): string {
  const isUK = country === 'GB';
  const ukGuidance = isUK
    ? `
This document is from a UK customer. Apply UK conventions:
- Money is in pounds sterling (£, GBP). Strip any £ when populating numeric fields.
- Use UK insurer terminology: "excess" (not "deductible"), "buildings & contents" (not "homeowner's"), "motor" (not "auto"), "private medical" (not "PPO"), "income protection" (not "disability").
- For credit card benefits, surface Section 75 (joint liability with retailer for £100–£30,000 purchases) and chargeback rights where relevant.
- Health policies typically sit alongside the NHS — note this in the summary if the document refers to it.
- Common UK insurers to recognise: Aviva, Direct Line, LV=, Admiral, More Than, Bupa, AXA, Hiscox, Legal & General, Petplan, Halifax, HSBC, Barclays, NatWest, Lloyds, Monzo, Starling, RSA.
- FCA-authorised firms cite an FRN — capture into policyNo if present.
`
    : `
The user's country is ${country} and currency is ${currency}. Use local conventions where possible.
`;

  return `You are a document parser for Benefitly, a coverage management application.
Extract the following structured fields from this insurance policy, warranty, or coverage document.
Return ONLY valid JSON with no markdown formatting.
${ukGuidance}
Required fields:
{
  "provider": "Name of the insurer, warranty provider, or card issuer",
  "type": "Type of cover (e.g. Private Medical Insurance, Comprehensive Motor Insurance, AppleCare+, Card Benefits / Section 75)",
  "category": "One of: health, dental, vision, life, disability, auto, home, travel, pet, warranty, creditcard, business",
  "policyNo": "Policy number, membership number, FRN, or account reference",
  "covered": ["List of covered people, vehicles, properties, or items"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD or 'Ongoing'",
  "premium": 0,
  "deductible": 0,
  "oopMax": null,
  "coverageLimit": "Cover limit description (use the document's wording, including currency symbol)",
  "coInsurance": "Co-insurance / excess split or null",
  "exclusions": ["List of exclusions"],
  "claimPhone": "Claims phone number",
  "claimUrl": "Claims website URL",
  "summary": "One-sentence plain-language summary of what this cover does, in the user's region",
  "confidence": 0.0 to 1.0
}

Set confidence to:
- 0.9+ if the document is clear and all fields are explicitly stated
- 0.7-0.9 if some fields are inferred or partially visible
- Below 0.7 if the document is unclear, damaged, or missing key information

For any field you cannot find, use null (for strings/numbers) or empty array (for arrays).`;
}
