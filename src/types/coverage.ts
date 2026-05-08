// Coverage data model — based on PRD section 7.1

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

export interface SearchMatch {
  coverageId: string;
  provider: string;
  type: string;
  relevance: 'high' | 'medium' | 'low';
  citedField: 'covered' | 'exclusions' | 'summary' | 'type' | 'coverageLimit' | 'coInsurance';
  citedValue: string;
  explanation: string;
  coordination: string;
  sourceDocumentId: string | null;
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
