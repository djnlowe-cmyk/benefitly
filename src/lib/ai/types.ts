// Shape returned by the production parse pipeline. Stored as JSON-encoded
// text in Document.parsedData; the bench harness scores against the same
// shape so a schema drift here is caught by ALI-123's quality gate.

export interface ParsedDocument {
  provider?: string | null;
  type?: string | null;
  category?: string | null;
  policyNo?: string | null;
  covered?: string[];
  startDate?: string | null;
  endDate?: string | null;
  premium?: number | null;
  deductible?: number | null;
  oopMax?: number | null;
  coverageLimit?: string | null;
  coInsurance?: string | null;
  exclusions?: string[];
  claimPhone?: string | null;
  claimUrl?: string | null;
  summary?: string | null;
  confidence?: number | null;
}
