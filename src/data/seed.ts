import { Transaction, Asset, Claim, Aggregator, Coverage, Alert } from '@/types/coverage';

// Coverages and alerts are now fetched from /api/coverages and /api/alerts.
// Transactions / assets / claims still rely on local seed until backing API
// routes exist.
// SEED_COVERAGES and SEED_ALERTS are kept as empty arrays so AppShell's
// initial useState() call has a stable typed value before the fetch resolves.
export const SEED_COVERAGES: Coverage[] = [];
export const SEED_ALERTS: Alert[] = [];

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 1, date: '2026-03-15', merchant: 'Apple Store', amount: 2499, card: 'Chase Sapphire Reserve', cardType: 'credit', category: 'Electronics', coverageStatus: 'covered', benefits: ['120-day purchase protection ($10K)', 'Extended warranty (+1 year)'], missedOpp: null },
  { id: 2, date: '2026-03-12', merchant: 'Delta Airlines', amount: 862, card: 'Citi Double Cash', cardType: 'credit', category: 'Travel', coverageStatus: 'partial', benefits: ['None — no travel insurance on this card'], missedOpp: 'Your Chase Sapphire Reserve includes trip-cancellation ($10K) and trip-delay coverage ($500/day). Use it for travel bookings.' },
  { id: 3, date: '2026-03-10', merchant: 'Best Buy', amount: 1299, card: 'Debit •••• 7733', cardType: 'debit', category: 'Electronics', coverageStatus: 'uncovered', benefits: [], missedOpp: "Paid with debit — no purchase protection or extended warranty. Your Chase Sapphire Reserve would have provided 120-day damage/theft protection and an extra year of warranty." },
  { id: 4, date: '2026-03-08', merchant: 'Home Depot', amount: 487, card: 'Chase Sapphire Reserve', cardType: 'credit', category: 'Home', coverageStatus: 'covered', benefits: ['120-day purchase protection ($10K)'], missedOpp: null },
  { id: 5, date: '2026-03-05', merchant: 'Hertz Car Rental', amount: 342, card: 'Chase Sapphire Reserve', cardType: 'credit', category: 'Travel', coverageStatus: 'covered', benefits: ['Primary rental car CDW (up to $75K)'], missedOpp: null },
  { id: 6, date: '2026-03-02', merchant: 'Wayfair', amount: 1850, card: 'Debit •••• 7733', cardType: 'debit', category: 'Furniture', coverageStatus: 'uncovered', benefits: [], missedOpp: "Paid with debit — no protection. If purchased on your Chase Sapphire Reserve, you'd have 120-day purchase protection against damage or theft." },
  { id: 7, date: '2026-02-28', merchant: 'Samsung.com', amount: 349, card: 'Amex Blue Cash', cardType: 'credit', category: 'Electronics', coverageStatus: 'partial', benefits: ['90-day purchase protection ($1K limit)'], missedOpp: 'Your Chase Sapphire Reserve offers better coverage: 120-day window, $10K limit, and +1 year extended warranty vs. 90 days and $1K on this card.' },
  { id: 8, date: '2026-02-25', merchant: 'United Airlines', amount: 1240, card: 'Chase Sapphire Reserve', cardType: 'credit', category: 'Travel', coverageStatus: 'covered', benefits: ['Trip cancellation ($10K)', 'Trip delay ($500/day)', 'Baggage delay ($100/day)'], missedOpp: null },
];

export const SEED_ASSETS: Asset[] = [
  { id: 1, name: 'MacBook Pro 16" (2024)', category: 'Electronics', value: 3499, purchaseDate: '2024-03-10', photos: 3, lastPhotoUpdate: '2025-11-20', coverages: ['AppleCare+', 'Chase purchase protection (expired)'], riskLevel: 'medium', riskNote: 'AppleCare+ expires 10 March 2026 — 8 days remaining' },
  { id: 2, name: 'Samsung RF28 Refrigerator', category: 'Appliances', value: 2199, purchaseDate: '2024-11-15', photos: 2, lastPhotoUpdate: '2024-11-15', coverages: ['Samsung 1-year warranty', '10-year compressor warranty'], riskLevel: 'high', riskNote: 'Standard warranty expires Nov 2025. Was this purchased on a credit card with extended warranty?' },
  { id: 3, name: '2022 Toyota RAV4', category: 'Vehicles', value: 34500, purchaseDate: '2022-06-01', photos: 8, lastPhotoUpdate: '2026-01-15', coverages: ['State Farm comprehensive + collision'], riskLevel: 'low', riskNote: 'Fully covered. Photos current.' },
  { id: 4, name: '742 Evergreen Terrace (Home)', category: 'Property', value: 450000, purchaseDate: '2020-08-15', photos: 24, lastPhotoUpdate: '2025-09-01', coverages: ['Allstate HO-3 ($450K dwelling)'], riskLevel: 'medium', riskNote: 'Photos 6 months old. Update exterior photos before storm season.' },
  { id: 5, name: 'Sony A7 IV Camera', category: 'Electronics', value: 2498, purchaseDate: '2025-12-20', photos: 1, lastPhotoUpdate: '2025-12-20', coverages: ['Sony 1-year warranty', 'Chase extended warranty (+1 year)'], riskLevel: 'low', riskNote: 'Fully covered through Dec 2027.' },
  { id: 6, name: 'Peloton Bike+', category: 'Fitness', value: 2495, purchaseDate: '2025-06-10', photos: 0, lastPhotoUpdate: null, coverages: ['Peloton 1-year warranty'], riskLevel: 'high', riskNote: 'No photos on file. Warranty expires June 2026. No credit-card protection detected.' },
];

export const SEED_CLAIMS: Claim[] = [
  { id: 1, incident: 'Cracked laptop screen', date: '2026-03-16', provider: 'Apple (AppleCare+)', category: 'warranty', status: 'in_progress', step: 2, totalSteps: 5, steps: ['Log incident', 'Gather documentation', 'Visit Apple Store', 'Submit for repair', 'Track resolution'], nextAction: 'Visit Apple Store for assessment — appointment booked 20 March', deadline: '2026-03-20' },
  { id: 2, incident: 'Flight delay — Delta DL412', date: '2026-02-14', provider: 'Chase Sapphire Reserve', category: 'travel', status: 'submitted', step: 4, totalSteps: 5, steps: ['Log incident', 'Gather receipts', 'Fill claim form', 'Submit claim', 'Await decision'], nextAction: 'Claim submitted 18 Feb. Expected decision within 10 business days.', deadline: null },
  { id: 3, incident: 'Hail damage to RAV4 hood', date: '2025-12-05', provider: 'State Farm', category: 'auto', status: 'paid', step: 5, totalSteps: 5, steps: ['Log incident', 'File police report', 'Submit photos', 'Adjuster visit', 'Receive payment'], nextAction: 'Claim resolved. $1,847 paid after $500 deductible.', deadline: null },
];

export const SEARCH_SCENARIOS: Record<
  string,
  { policyNo: string; relevance: 'high' | 'medium' | 'low'; explanation: string; coordination: string }[]
> = {
  'laptop screen cracked': [
    { policyNo: 'AC-MBP-2024-7791', relevance: 'high', explanation: 'AppleCare+ covers accidental damage. $99 service fee per incident. File at support.apple.com or any Apple Store.', coordination: 'Primary coverage — file here first.' },
    { policyNo: 'VISA •••• 4821', relevance: 'medium', explanation: 'Chase Sapphire purchase protection covers damage within 120 days of purchase. If purchased on this card and within the window, up to $10,000.', coordination: "Secondary — use if AppleCare+ doesn't fully cover or has expired." },
  ],
  'flight cancelled': [
    { policyNo: 'ALZ-TRIP-90321', relevance: 'high', explanation: 'Allianz trip cancellation covers up to $5,000 for covered reasons (illness, severe weather, airline bankruptcy). $250 deductible.', coordination: 'Primary for the Italy trip — file here first.' },
    { policyNo: 'VISA •••• 4821', relevance: 'high', explanation: 'Chase Sapphire trip cancellation covers up to $10,000 per person if the trip was purchased on the card. Covers illness, severe weather, jury duty, and more.', coordination: 'Use alongside or instead of Allianz depending on which card was used to book.' },
  ],
  'pipe burst': [
    { policyNo: 'ALL-HOME-55198', relevance: 'high', explanation: "Allstate homeowner's covers sudden water damage from burst pipes. $1,000 deductible. Covers structural repair and damaged personal property.", coordination: 'Primary — file immediately and document damage with photos.' },
  ],
  'client threatening lawsuit': [
    { policyNo: 'HFD-GL-2025-1142', relevance: 'high', explanation: 'Hartford general liability covers advertising injury and some client claims. $1M per occurrence. $1,000 deductible.', coordination: 'Notify Hartford immediately — most policies require prompt notice.' },
  ],
  'knee mri': [
    { policyNo: 'BCBS-2024-88412', relevance: 'high', explanation: 'BCBS PPO covers diagnostic imaging including MRI. Subject to deductible ($2,500) and 80/20 co-insurance. Pre-authorisation may be required.', coordination: 'Get a referral from your PCP and confirm pre-auth with BCBS before scheduling.' },
  ],
  'car accident': [
    { policyNo: 'SF-AUTO-77234', relevance: 'high', explanation: "State Farm covers collision damage. $500 deductible. Also covers liability if you're at fault (100/300/100). Rental reimbursement included.", coordination: "File with State Farm. If the other driver is at fault, their liability covers your damage first." },
    { policyNo: 'BCBS-2024-88412', relevance: 'medium', explanation: 'BCBS covers medical treatment from the accident after auto medical payments are exhausted.', coordination: 'Secondary to auto medical payments — file health claims after auto coverage is used.' },
  ],
};

export const AGGREGATORS: Aggregator[] = [
  { id: 'confused', name: 'Confused.com', url: 'https://www.confused.com', color: '#e11d48', bg: '#fff1f2', categories: ['auto', 'home', 'travel', 'life', 'pet'], loggedIn: true },
  { id: 'uswitch', name: 'Uswitch', url: 'https://www.uswitch.com', color: '#0ea5e9', bg: '#f0f9ff', categories: ['auto', 'home', 'life', 'health'], loggedIn: true },
  { id: 'moneysupermarket', name: 'MoneySupermarket', url: 'https://www.moneysupermarket.com', color: '#16a34a', bg: '#f0fdf4', categories: ['auto', 'home', 'travel', 'life', 'pet', 'health'], loggedIn: false },
  { id: 'gocompare', name: 'GoCompare', url: 'https://www.gocompare.com', color: '#7c3aed', bg: '#f5f3ff', categories: ['auto', 'home', 'travel', 'life', 'pet'], loggedIn: true },
  { id: 'comparethemarket', name: 'CompareTheMarket', url: 'https://www.comparethemarket.com', color: '#d97706', bg: '#fffbeb', categories: ['auto', 'home', 'travel', 'life', 'pet', 'health'], loggedIn: false },
];
