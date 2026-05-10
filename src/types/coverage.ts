// Coverage data model — based on PRD section 7.1

// A pointer back into the source document for one parsed field. The parser is
// asked for at most one anchor per populated field; the UI uses it to render a
// "from {filename} · p.{page}" caption that links to the underlying document.
export interface SourceAnchor {
  page?: number | null;
  excerpt?: string | null;
}

// Shape persisted into Document.parsedData. Stored as JSON-encoded text so the
// Prisma schema doesn't have to evolve every time the parser learns a new
// field — sourceAnchors rides through as a sibling key.
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
  sourceAnchors?: Record<string, SourceAnchor>;
}

export type CoverageCategory =
  | 'health'
  | 'dental'
  | 'vision'
  | 'life'
  | 'disability'
  | 'auto'
  | 'home'
  | 'travel'
  | 'pet'
  | 'warranty'
  | 'creditcard'
  | 'business';

export type CoverageStatus = 'active' | 'expiring' | 'expired' | 'pending';

export interface Coverage {
  id: string;
  provider: string;
  type: string;
  category: CoverageCategory;
  policyNo: string | null;
  status: CoverageStatus;
  statusLabel: string;
  covered: string[];
  startDate: string;
  endDate: string;
  premium: number;
  deductible: number | null;
  oopMax: number | null;
  coverageLimit: string | null;
  coInsurance: string | null;
  exclusions: string[];
  claimPhone: string | null;
  claimUrl: string | null;
  summary: string | null;
  // Optional in the SPA list response. Present when the coverage was created
  // from an upload; null for hand-entered coverages. confidence is the parser's
  // self-reported score (0–1) and drives the "needs review" banner on detail.
  documentId?: string | null;
  confidence?: number | null;
}

// Returned by GET /api/coverages/:id only — joins the source document.
// We never expose a URL here: the storage location is private (DPIA R-1),
// and the client must call GET /api/documents/[id]/url to mint a short-lived
// signed URL when the user actually clicks the document link.
export interface CoverageDocument {
  id: string;
  filename: string;
  mimeType: string;
}

// Response shape of GET /api/documents/[id]/url. `url` is a relative path
// to /api/documents/[id]/content with an HMAC token query param embedded;
// the browser can use it directly as an <a href> or fetch().
export interface DocumentSignedUrlResponse {
  url: string;
  expiresAt: string; // ISO timestamp
  ttlSeconds: number;
  filename: string;
  mimeType: string;
}

export interface CoverageDetailResponse extends Coverage {
  document: CoverageDocument | null;
}

export interface CategoryMeta {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

export interface StatusStyle {
  color: string;
  bg: string;
  label: string;
}

export interface Alert {
  id: string;
  type: 'expiring' | 'renewal' | 'unused' | 'gap' | 'claim';
  severity: 'warning' | 'info' | 'tip' | 'urgent';
  title: string;
  detail: string;
  date: string;
  coverageId: string | null;
  read: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
}

// One result row in the /api/search response. Excerpt is verbatim from the
// source coverage and citedField is a JSON path (e.g. "covered", "exclusions[2]")
// into the user's coverage record. Provider/type/sourceDocumentId are server
// enrichments so the UI can render result cards without a second round-trip.
export interface SearchMatch {
  coverageId: string;
  provider: string;
  type: string;
  relevance: 'high' | 'medium' | 'low';
  citedField: string;
  citedExcerpt: string;
  explanation: string;
  coordination?: string;
  sourceDocumentId: string | null;
}

// Returned only when results is empty. Names the cover types the user would
// typically need so the UI can render an actionable empty state instead of
// "no matches".
export interface SearchGapAnswer {
  explanation: string;
  recommendedTypes: string[];
}

// Complete /api/search response shape consumed by SearchView.
export interface SearchResponse {
  results: SearchMatch[];
  gapAnswer?: SearchGapAnswer;
  conciergeAvailable: true;
  error?: 'search-unavailable' | 'query required' | 'query too long';
}

export interface Transaction {
  id: number;
  date: string;
  merchant: string;
  amount: number;
  card: string;
  cardType: 'credit' | 'debit';
  category: string;
  coverageStatus: 'covered' | 'partial' | 'uncovered';
  benefits: string[];
  missedOpp: string | null;
}

export interface Asset {
  id: number;
  name: string;
  category: string;
  value: number;
  purchaseDate: string;
  photos: number;
  lastPhotoUpdate: string | null;
  coverages: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskNote: string;
}

export interface Claim {
  id: number;
  incident: string;
  date: string;
  provider: string;
  category: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'denied' | 'paid';
  step: number;
  totalSteps: number;
  steps: string[];
  nextAction: string;
  deadline: string | null;
}

export interface Aggregator {
  id: string;
  name: string;
  url: string;
  color: string;
  bg: string;
  categories: CoverageCategory[];
  loggedIn: boolean;
}

export type ViewId =
  | 'dashboard'
  | 'search'
  | 'policies'
  | 'transactions'
  | 'assets'
  | 'claims'
  | 'optimiser'
  | 'alerts'
  | 'vault'
  | 'add'
  | 'upload'
  | 'family'
  | 'account';
