import { Transaction, Asset, Claim, Aggregator, Coverage, Alert } from '@/types/coverage';

// Coverages and alerts are now fetched from /api/coverages and /api/alerts.
// Transactions / assets / claims still rely on local seed until backing API
// routes exist.
// SEED_COVERAGES and SEED_ALERTS are kept as empty arrays so AppShell's
// initial useState() call has a stable typed value before the fetch resolves.
export const SEED_COVERAGES: Coverage[] = [];
export const SEED_ALERTS: Alert[] = [];

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 1, date: '2026-03-15', merchant: 'Apple Store', amount: 2199, card: 'Barclaycard Avios Plus', cardType: 'credit', category: 'Electronics', coverageStatus: 'covered', benefits: ['Section 75 protection (purchases over £100)', 'Extended warranty (+1 year)'], missedOpp: null },
  { id: 2, date: '2026-03-12', merchant: 'British Airways', amount: 642, card: 'Halifax Clarity', cardType: 'credit', category: 'Travel', coverageStatus: 'partial', benefits: ['Section 75 cover for non-delivery / cancellation'], missedOpp: 'Your Barclaycard Avios Plus includes trip-cancellation cover (£10,000) and trip-delay cover (£500/day). Use it for travel bookings.' },
  { id: 3, date: '2026-03-10', merchant: 'Currys PC World', amount: 1099, card: 'Debit •••• 7733', cardType: 'debit', category: 'Electronics', coverageStatus: 'uncovered', benefits: [], missedOpp: 'Paid with debit — no Section 75 protection. A credit card on purchases £100–£30,000 would have given you joint liability with the retailer if the item is faulty or never arrives.' },
  { id: 4, date: '2026-03-08', merchant: 'B&Q', amount: 387, card: 'Barclaycard Avios Plus', cardType: 'credit', category: 'Home', coverageStatus: 'covered', benefits: ['Section 75 protection on purchases over £100'], missedOpp: null },
  { id: 5, date: '2026-03-05', merchant: 'Enterprise Rent-a-Car', amount: 268, card: 'Barclaycard Avios Plus', cardType: 'credit', category: 'Travel', coverageStatus: 'covered', benefits: ['Primary rental car CDW (up to £50,000)'], missedOpp: null },
  { id: 6, date: '2026-03-02', merchant: 'John Lewis', amount: 1450, card: 'Debit •••• 7733', cardType: 'debit', category: 'Furniture', coverageStatus: 'uncovered', benefits: [], missedOpp: "Paid with debit — no Section 75 protection. The same purchase on your Barclaycard would have given you chargeback rights and joint liability with John Lewis if the item arrives damaged." },
  { id: 7, date: '2026-02-28', merchant: 'Samsung.com', amount: 299, card: 'HSBC Premier Mastercard', cardType: 'credit', category: 'Electronics', coverageStatus: 'partial', benefits: ['Section 75 protection (purchases over £100)'], missedOpp: 'Your Barclaycard Avios Plus offers better cover: longer purchase protection window and an extra year of extended warranty on top of Section 75.' },
  { id: 8, date: '2026-02-25', merchant: 'easyJet', amount: 412, card: 'Barclaycard Avios Plus', cardType: 'credit', category: 'Travel', coverageStatus: 'covered', benefits: ['Trip cancellation (£10,000)', 'Trip delay (£500/day)', 'Baggage delay (£100/day)'], missedOpp: null },
];

export const SEED_ASSETS: Asset[] = [
  { id: 1, name: 'MacBook Pro 16" (2024)', category: 'Electronics', value: 2999, purchaseDate: '2024-03-10', photos: 3, lastPhotoUpdate: '2025-11-20', coverages: ['AppleCare+', 'Barclaycard Section 75 (covered at purchase)'], riskLevel: 'medium', riskNote: 'AppleCare+ expires 10 March 2026 — 8 days remaining' },
  { id: 2, name: 'Samsung RF28 Refrigerator', category: 'Appliances', value: 1849, purchaseDate: '2024-11-15', photos: 2, lastPhotoUpdate: '2024-11-15', coverages: ['Samsung 1-year warranty', 'Consumer Rights Act protection (6 yrs in England/Wales, 5 yrs in Scotland)'], riskLevel: 'high', riskNote: 'Standard warranty expires Nov 2025. Was this purchased on a credit card with extended warranty cover?' },
  { id: 3, name: '2022 Toyota RAV4', category: 'Vehicles', value: 28500, purchaseDate: '2022-06-01', photos: 8, lastPhotoUpdate: '2026-01-15', coverages: ['Direct Line Comprehensive Motor'], riskLevel: 'low', riskNote: 'Fully comprehensive. Photos current. NCB protected.' },
  { id: 4, name: '14 Acacia Avenue, London SW19 4PT', category: 'Property', value: 685000, purchaseDate: '2020-08-15', photos: 24, lastPhotoUpdate: '2025-09-01', coverages: ['Aviva Buildings & Contents (£500K buildings, £75K contents)'], riskLevel: 'medium', riskNote: 'Photos 6 months old. Update exterior photos before storm season.' },
  { id: 5, name: 'Sony A7 IV Camera', category: 'Electronics', value: 2098, purchaseDate: '2025-12-20', photos: 1, lastPhotoUpdate: '2025-12-20', coverages: ['Sony 1-year warranty', 'Barclaycard extended warranty (+1 year)'], riskLevel: 'low', riskNote: 'Fully covered through Dec 2027.' },
  { id: 6, name: 'Peloton Bike+', category: 'Fitness', value: 2295, purchaseDate: '2025-06-10', photos: 0, lastPhotoUpdate: null, coverages: ['Peloton 1-year warranty'], riskLevel: 'high', riskNote: 'No photos on file. Warranty expires June 2026. No credit-card protection detected.' },
];

export const SEED_CLAIMS: Claim[] = [
  { id: 1, incident: 'Cracked laptop screen', date: '2026-03-16', provider: 'Apple (AppleCare+)', category: 'warranty', status: 'in_progress', step: 2, totalSteps: 5, steps: ['Log incident', 'Gather documentation', 'Visit Apple Store', 'Submit for repair', 'Track resolution'], nextAction: 'Visit Apple Store Regent Street for assessment — appointment booked 20 March', deadline: '2026-03-20' },
  { id: 2, incident: 'Flight delay — BA117', date: '2026-02-14', provider: 'Barclaycard Avios Plus', category: 'travel', status: 'submitted', step: 4, totalSteps: 5, steps: ['Log incident', 'Gather receipts', 'Fill claim form', 'Submit claim', 'Await decision'], nextAction: 'Claim submitted 18 Feb. Expected decision within 10 working days. Also consider EU261/UK261 compensation direct from BA.', deadline: null },
  { id: 3, incident: 'Hail damage to RAV4 bonnet', date: '2025-12-05', provider: 'Direct Line', category: 'auto', status: 'paid', step: 5, totalSteps: 5, steps: ['Log incident', 'Report to police if required', 'Submit photos', 'Loss adjuster visit', 'Receive settlement'], nextAction: 'Claim resolved. £1,420 paid after £350 excess.', deadline: null },
];

export const AGGREGATORS: Aggregator[] = [
  { id: 'confused', name: 'Confused.com', url: 'https://www.confused.com', color: '#e11d48', bg: '#fff1f2', categories: ['auto', 'home', 'travel', 'life', 'pet'], loggedIn: true },
  { id: 'uswitch', name: 'Uswitch', url: 'https://www.uswitch.com', color: '#0ea5e9', bg: '#f0f9ff', categories: ['auto', 'home', 'life', 'health'], loggedIn: true },
  { id: 'moneysupermarket', name: 'MoneySupermarket', url: 'https://www.moneysupermarket.com', color: '#16a34a', bg: '#f0fdf4', categories: ['auto', 'home', 'travel', 'life', 'pet', 'health'], loggedIn: false },
  { id: 'gocompare', name: 'GoCompare', url: 'https://www.gocompare.com', color: '#7c3aed', bg: '#f5f3ff', categories: ['auto', 'home', 'travel', 'life', 'pet'], loggedIn: true },
  { id: 'comparethemarket', name: 'CompareTheMarket', url: 'https://www.comparethemarket.com', color: '#d97706', bg: '#fffbeb', categories: ['auto', 'home', 'travel', 'life', 'pet', 'health'], loggedIn: false },
];
