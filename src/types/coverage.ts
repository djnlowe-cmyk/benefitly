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
  id: number;
  provider: string;
  type: string;
  category: CoverageCategory;
  policyNo: string;
  status: CoverageStatus;
  statusLabel: string;
  covered: string[];
  startDate: string;
  endDate: string;
  premium: number;
  deductible: number | null;
  oopMax: number | null;
  limit: string;
  coInsurance: string | null;
  exclusions: string[];
  claimPhone: string;
  claimUrl: string;
  summary: string;
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
  id: number;
  type: 'expiring' | 'renewal' | 'unused' | 'gap' | 'claim';
  severity: 'warning' | 'info' | 'tip' | 'urgent';
  title: string;
  detail: string;
  date: string;
  coverageId: number;
  read: boolean;
}

export interface SearchResult {
  coverageId: number;
  relevance: 'high' | 'medium' | 'low';
  explanation: string;
  coordination: string;
  coverage?: Coverage;
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
  | 'account';
