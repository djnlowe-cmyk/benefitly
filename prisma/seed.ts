import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const passwordHash = await hash('benefitly-demo-2026', 12);
  const user = await prisma.user.upsert({
    where: { email: 'david@benefitly.app' },
    update: {},
    create: {
      email: 'david@benefitly.app',
      name: 'David Lowe',
      passwordHash,
    },
  });

  // Seed coverages
  const coverages = [
    { provider: 'Blue Cross Blue Shield', type: 'Health Insurance', category: 'health', policyNo: 'BCBS-2024-88412', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe', 'Sarah Lowe', 'Emma Lowe']), startDate: '2025-01-01', endDate: '2025-12-31', premium: 624, deductible: 2500, oopMax: 6500, coverageLimit: 'Unlimited (in-network)', coInsurance: '80/20 after deductible', exclusions: JSON.stringify(['Cosmetic surgery', 'Experimental treatments', 'Out-of-network without referral']), claimPhone: '1-800-555-0101', claimUrl: 'bcbs.com/claims', summary: 'Family PPO plan through employer. Covers medical, prescription, and preventive care.' },
    { provider: 'State Farm', type: 'Auto Insurance', category: 'auto', policyNo: 'SF-AUTO-77234', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['2022 Toyota RAV4', '2020 Honda Civic']), startDate: '2025-03-15', endDate: '2026-03-14', premium: 186, deductible: 500, oopMax: null, coverageLimit: '100/300/100 Liability, Comprehensive + Collision', coInsurance: null, exclusions: JSON.stringify(['Intentional damage', 'Racing', 'Ride-share use (not endorsed)']), claimPhone: '1-800-555-0202', claimUrl: 'statefarm.com/claims', summary: 'Full coverage on both vehicles. Includes roadside assistance and rental reimbursement.' },
    { provider: 'Allstate', type: "Homeowner's Insurance", category: 'home', policyNo: 'ALL-HOME-55198', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['742 Evergreen Terrace']), startDate: '2025-06-01', endDate: '2026-05-31', premium: 215, deductible: 1000, oopMax: null, coverageLimit: '$450,000 dwelling / $225,000 personal property', coInsurance: null, exclusions: JSON.stringify(['Flood', 'Earthquake', 'Mold (unless sudden)', 'Sewer backup (no rider)']), claimPhone: '1-800-555-0303', claimUrl: 'allstate.com/claims', summary: 'HO-3 policy. Covers dwelling, personal property, liability, and additional living expenses.' },
    { provider: 'Chase Sapphire Reserve', type: 'Credit Card Benefits', category: 'creditcard', policyNo: 'VISA •••• 4821', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['All purchases on card']), startDate: '2024-08-01', endDate: 'Ongoing', premium: 550, deductible: 0, oopMax: null, coverageLimit: '$10,000 per claim / $50,000 per year (purchase protection); 120 days', coInsurance: null, exclusions: JSON.stringify(['Used items', 'Motorised vehicles', 'Real estate', 'Cash/securities']), claimPhone: '1-800-555-0404', claimUrl: 'chase.com/card-benefits', summary: 'Purchase protection, extended warranty (+1 year), trip cancellation, trip delay, rental car CDW, baggage delay, lost luggage.' },
    { provider: 'Apple', type: 'AppleCare+', category: 'warranty', policyNo: 'AC-MBP-2024-7791', status: 'expiring', statusLabel: 'Expiring Soon', covered: JSON.stringify(['MacBook Pro 16" (2024)']), startDate: '2024-03-10', endDate: '2026-03-10', premium: 399, deductible: 99, oopMax: null, coverageLimit: '2 incidents of accidental damage per year', coInsurance: null, exclusions: JSON.stringify(['Cosmetic damage only', 'Unauthorised modifications', 'Theft/loss (no add-on)']), claimPhone: '1-800-555-0505', claimUrl: 'support.apple.com', summary: 'Extended warranty and accidental damage coverage for MacBook Pro. Expires in 8 days.' },
    { provider: 'Allianz', type: 'Travel Insurance', category: 'travel', policyNo: 'ALZ-TRIP-90321', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe', 'Sarah Lowe']), startDate: '2026-04-01', endDate: '2026-04-15', premium: 189, deductible: 250, oopMax: null, coverageLimit: '$50,000 medical / $5,000 trip cancellation / $1,500 baggage', coInsurance: null, exclusions: JSON.stringify(['Pre-existing conditions (60-day lookback)', 'Extreme sports', 'Travel to sanctioned countries']), claimPhone: '1-800-555-0606', claimUrl: 'allianzassistance.com/claims', summary: 'Single-trip policy for Italy vacation. Covers medical, cancellation, baggage, and delay.' },
    { provider: 'Samsung', type: 'Manufacturer Warranty', category: 'warranty', policyNo: 'SAM-WTY-RF28-8842', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['Samsung RF28 Refrigerator']), startDate: '2024-11-15', endDate: '2025-11-14', premium: 0, deductible: 0, oopMax: null, coverageLimit: 'Parts and labour for manufacturing defects', coInsurance: null, exclusions: JSON.stringify(['Cosmetic damage', 'Power surges', 'Improper installation', 'Commercial use']), claimPhone: '1-800-555-0707', claimUrl: 'samsung.com/support', summary: '1-year standard manufacturer warranty. Compressor has separate 10-year warranty.' },
    { provider: 'Hartford', type: 'General Liability (Business)', category: 'business', policyNo: 'HFD-GL-2025-1142', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['Lowe Digital LLC']), startDate: '2025-01-01', endDate: '2026-01-01', premium: 412, deductible: 1000, oopMax: null, coverageLimit: '$1M per occurrence / $2M aggregate', coInsurance: null, exclusions: JSON.stringify(['Professional services errors (see E&O)', 'Auto liability', "Workers' comp claims", 'Intentional acts']), claimPhone: '1-800-555-0808', claimUrl: 'thehartford.com/claims', summary: 'Commercial general liability for the digital agency. Covers bodily injury, property damage, and advertising injury.' },
    { provider: 'Delta Dental', type: 'Dental Insurance', category: 'dental', policyNo: 'DD-FAM-2025-3318', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe', 'Sarah Lowe', 'Emma Lowe']), startDate: '2025-01-01', endDate: '2025-12-31', premium: 62, deductible: 50, oopMax: null, coverageLimit: '$1,500/person/year (preventive 100%, basic 80%, major 50%)', coInsurance: '50% for major procedures (crowns, bridges, dentures)', exclusions: JSON.stringify(['Cosmetic dentistry', 'Orthodontics (adult)', 'Implants over $2,000']), claimPhone: '1-800-555-0909', claimUrl: 'deltadental.com/claims', summary: 'Family dental PPO through employer. Preventive care (cleanings, X-rays) covered at 100%. Two cleanings per year.' },
    { provider: 'MetLife', type: 'Life Insurance', category: 'life', policyNo: 'ML-LIFE-2025-9201', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe']), startDate: '2023-06-01', endDate: '2033-06-01', premium: 48, deductible: 0, oopMax: null, coverageLimit: '$500,000 death benefit (10-year level term)', coInsurance: null, exclusions: JSON.stringify(['Suicide within first 2 years', 'Death during commission of a felony', 'War or military action']), claimPhone: '1-800-555-1111', claimUrl: 'metlife.com/claims', summary: '10-year level term life policy. $500K death benefit. Beneficiary: Sarah Lowe.' },
    { provider: 'Nationwide', type: 'Pet Insurance', category: 'pet', policyNo: 'NW-PET-2025-6633', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['Biscuit (Golden Retriever, 4 yrs)']), startDate: '2025-02-01', endDate: '2026-02-01', premium: 52, deductible: 250, oopMax: null, coverageLimit: '$10,000/year (accidents & illness), 70% reimbursement', coInsurance: '70/30 after deductible', exclusions: JSON.stringify(['Pre-existing conditions', 'Breeding costs', 'Cosmetic procedures', 'Dental cleaning (no rider)']), claimPhone: '1-800-555-1313', claimUrl: 'petinsurance.com/claims', summary: 'Accident and illness coverage for Biscuit. Covers vet visits, surgery, prescriptions, and diagnostics.' },
  ];

  for (const c of coverages) {
    await prisma.coverage.create({ data: { ...c, userId: user.id } });
  }

  // Seed alerts
  const allCoverages = await prisma.coverage.findMany({ where: { userId: user.id } });
  const coverageMap = new Map(allCoverages.map(c => [c.policyNo, c.id]));

  const alerts = [
    { type: 'expiring', severity: 'warning', title: 'AppleCare+ expiring in 8 days', detail: 'MacBook Pro 16" coverage ends 10 March 2026. Consider renewing or purchasing new coverage.', date: '2026-03-02', coverageId: coverageMap.get('AC-MBP-2024-7791') || null, read: false },
    { type: 'renewal', severity: 'info', title: 'Auto insurance renewal coming up', detail: 'State Farm policy renews 14 March 2026. Review terms and compare rates before renewal.', date: '2026-02-14', coverageId: coverageMap.get('SF-AUTO-77234') || null, read: false },
    { type: 'unused', severity: 'tip', title: 'Unused benefit: Trip delay coverage', detail: 'Your Chase Sapphire Reserve includes $500/day trip delay coverage.', date: '2026-03-01', coverageId: coverageMap.get('VISA •••• 4821') || null, read: true },
    { type: 'gap', severity: 'warning', title: 'No flood insurance detected', detail: "Your homeowner's policy excludes flood damage. Consider a separate flood policy.", date: '2026-01-15', coverageId: coverageMap.get('ALL-HOME-55198') || null, read: true },
  ];

  for (const a of alerts) {
    await prisma.alert.create({ data: { ...a, userId: user.id } });
  }

  // Seed family members
  await prisma.familyMember.createMany({
    data: [
      { name: 'Sarah Lowe', relation: 'spouse', userId: user.id },
      { name: 'Emma Lowe', relation: 'child', userId: user.id },
    ],
  });

  console.log('Seed complete: 1 user, %d coverages, %d alerts, 2 family members', coverages.length, alerts.length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
