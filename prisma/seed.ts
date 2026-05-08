import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo user (defaults to GB / GBP via schema defaults)
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

  // Seed coverages — UK-tuned
  const coverages = [
    { provider: 'Bupa', type: 'Private Medical Insurance', category: 'health', policyNo: 'BUPA-2024-88412', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe', 'Sarah Lowe', 'Emma Lowe']), startDate: '2025-01-01', endDate: '2025-12-31', premium: 168, deductible: 250, oopMax: null, coverageLimit: 'Outpatient + inpatient + diagnostics; cancer cover; mental health add-on', coInsurance: null, exclusions: JSON.stringify(['Cosmetic surgery', 'Pre-existing conditions (moratorium)', 'NHS routine maternity', 'Fertility treatment']), claimPhone: '0345 609 0111', claimUrl: 'bupa.co.uk/claims', summary: 'Family Bupa Select Health policy through employer. Sits alongside the NHS — used for faster diagnostics and consultant access.' },
    { provider: 'Direct Line', type: 'Comprehensive Motor Insurance', category: 'auto', policyNo: 'DL-AUTO-77234', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['2022 Toyota RAV4', '2020 Honda Civic']), startDate: '2025-03-15', endDate: '2026-03-14', premium: 92, deductible: 350, oopMax: null, coverageLimit: 'Fully comprehensive; £2M third-party property; unlimited third-party injury', coInsurance: null, exclusions: JSON.stringify(['Driving without a valid licence', 'Track day use', 'Hire & reward (delivery work)']), claimPhone: '0345 246 8701', claimUrl: 'directline.com/car-claims', summary: 'Fully comprehensive policy on both vehicles. Includes courtesy car and protected NCB.' },
    { provider: 'Aviva', type: 'Buildings & Contents Insurance', category: 'home', policyNo: 'AVV-HOME-55198', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['14 Acacia Avenue, London SW19 4PT']), startDate: '2025-06-01', endDate: '2026-05-31', premium: 38, deductible: 250, oopMax: null, coverageLimit: '£500,000 buildings / £75,000 contents / £15,000 valuables', coInsurance: null, exclusions: JSON.stringify(['Storm damage to fences/gates', 'Wear and tear', 'Subsidence (no add-on)', 'Accidental damage (no add-on)']), claimPhone: '0345 030 6925', claimUrl: 'aviva.co.uk/claims', summary: 'Aviva home insurance — buildings and contents combined. 24-hour emergency claims line. Trace-and-access for escape of water.' },
    { provider: 'Barclaycard', type: 'Avios Plus Card Benefits', category: 'creditcard', policyNo: 'BARCLAY-AVIOS-4821', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['All purchases on card']), startDate: '2024-08-01', endDate: 'Ongoing', premium: 20, deductible: 0, oopMax: null, coverageLimit: 'Section 75 protection on £100–£30,000 purchases (joint liability with retailer); travel insurance bundle; rental car CDW', coInsurance: null, exclusions: JSON.stringify(['Cash advances', 'Used / second-hand goods', 'Property purchases', 'Securities and investments']), claimPhone: '0800 197 5953', claimUrl: 'barclaycard.co.uk/personal/customer/claims', summary: 'Statutory Section 75 cover on every purchase £100–£30,000, plus travel cancellation/delay, baggage and rental car CDW.' },
    { provider: 'Apple', type: 'AppleCare+', category: 'warranty', policyNo: 'AC-MBP-2024-7791', status: 'expiring', statusLabel: 'Expiring Soon', covered: JSON.stringify(['MacBook Pro 16" (2024)']), startDate: '2024-03-10', endDate: '2026-03-10', premium: 17, deductible: 79, oopMax: null, coverageLimit: '2 incidents of accidental damage per 12 months', coInsurance: null, exclusions: JSON.stringify(['Cosmetic-only damage', 'Unauthorised modifications', 'Theft / loss (no add-on)']), claimPhone: '0800 048 0408', claimUrl: 'support.apple.com', summary: 'Extended warranty and accidental damage cover for MacBook Pro. Expires in 8 days.' },
    { provider: 'Aviva', type: 'Single-Trip Travel Insurance', category: 'travel', policyNo: 'AVV-TRIP-90321', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe', 'Sarah Lowe']), startDate: '2026-04-01', endDate: '2026-04-15', premium: 0, deductible: 150, oopMax: null, coverageLimit: '£10M emergency medical / £5,000 cancellation / £2,500 baggage', coInsurance: null, exclusions: JSON.stringify(['Pre-existing conditions not declared', 'Hazardous activities (no add-on)', 'Travel against FCDO advice']), claimPhone: '0345 366 9750', claimUrl: 'aviva.co.uk/travel-claims', summary: 'Single-trip Aviva travel policy for Italy. Covers emergency medical, cancellation, baggage and delay.' },
    { provider: 'Samsung', type: 'Manufacturer Warranty', category: 'warranty', policyNo: 'SAM-WTY-RF28-8842', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['Samsung RF28 Refrigerator']), startDate: '2024-11-15', endDate: '2025-11-14', premium: 0, deductible: 0, oopMax: null, coverageLimit: 'Parts and labour for manufacturing defects (separate 10-year compressor)', coInsurance: null, exclusions: JSON.stringify(['Cosmetic damage', 'Power surges', 'Improper installation', 'Commercial use']), claimPhone: '0333 000 0333', claimUrl: 'samsung.com/uk/support', summary: '1-year standard manufacturer warranty. Consumer Rights Act 2015 also gives statutory cover for up to 6 years in England/Wales.' },
    { provider: 'Hiscox', type: 'Business Insurance', category: 'business', policyNo: 'HISCOX-GL-2025-1142', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['Lowe Digital Ltd']), startDate: '2025-01-01', endDate: '2026-01-01', premium: 65, deductible: 500, oopMax: null, coverageLimit: '£2M public liability / £2M professional indemnity / £100K cyber', coInsurance: null, exclusions: JSON.stringify(['Known prior claims', 'Fines and penalties', 'Employee dishonesty (separate cover)', 'Contracts with US-based clients (no add-on)']), claimPhone: '0800 116 4627', claimUrl: 'hiscox.co.uk/claims', summary: 'Combined business insurance — public liability, professional indemnity, and cyber for the digital agency.' },
    { provider: 'Bupa Dental', type: 'Dental Cash Plan', category: 'dental', policyNo: 'BUPA-DENTAL-3318', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe', 'Sarah Lowe', 'Emma Lowe']), startDate: '2025-01-01', endDate: '2025-12-31', premium: 24, deductible: 0, oopMax: null, coverageLimit: 'Up to £750/person/year. Covers NHS or private dental costs.', coInsurance: '75% reimbursement on most treatments', exclusions: JSON.stringify(['Cosmetic dentistry', 'Adult orthodontics', 'Treatment started before policy began']), claimPhone: '0345 753 7838', claimUrl: 'bupa.co.uk/dental', summary: 'Family dental cash plan. Reimburses NHS or private dental costs against an annual allowance.' },
    { provider: 'Legal & General', type: 'Level Term Life Insurance', category: 'life', policyNo: 'LG-LIFE-2025-9201', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['David Lowe']), startDate: '2023-06-01', endDate: '2033-06-01', premium: 18, deductible: 0, oopMax: null, coverageLimit: '£500,000 lump sum (10-year level term)', coInsurance: null, exclusions: JSON.stringify(['Suicide within first 12 months', 'Misrepresentation on application', 'War / nuclear risk']), claimPhone: '0370 010 4080', claimUrl: 'legalandgeneral.com/claims', summary: '10-year level term life policy. £500K lump sum on death. Written in trust for Sarah Lowe.' },
    { provider: 'Petplan', type: 'Pet Insurance', category: 'pet', policyNo: 'PETPLAN-2025-6633', status: 'active', statusLabel: 'Active', covered: JSON.stringify(['Biscuit (Golden Retriever, 4 yrs)']), startDate: '2025-02-01', endDate: '2026-02-01', premium: 38, deductible: 99, oopMax: null, coverageLimit: '£12,000/year vet fees (covered for life)', coInsurance: '20% co-payment after age 9', exclusions: JSON.stringify(['Pre-existing conditions', 'Breeding costs', 'Routine dental cleaning', 'Behavioural training']), claimPhone: '0345 077 1934', claimUrl: 'petplan.co.uk/claims', summary: 'Covered For Life policy for Biscuit. Vet fees, surgery, prescriptions, and diagnostics with no per-condition limit.' },
  ];

  for (const c of coverages) {
    await prisma.coverage.create({ data: { ...c, userId: user.id } });
  }

  // Seed alerts
  const allCoverages = await prisma.coverage.findMany({ where: { userId: user.id } });
  const coverageMap = new Map(allCoverages.map(c => [c.policyNo, c.id]));

  const alerts = [
    { type: 'expiring', severity: 'warning', title: 'AppleCare+ expiring in 8 days', detail: 'MacBook Pro 16" cover ends 10 March 2026. Consider renewing or purchasing new cover.', date: '2026-03-02', coverageId: coverageMap.get('AC-MBP-2024-7791') || null, read: false },
    { type: 'renewal', severity: 'info', title: 'Motor insurance renewal coming up', detail: 'Direct Line policy renews 14 March 2026. Compare quotes early — staying with the same insurer is rarely the cheapest option in the UK.', date: '2026-02-14', coverageId: coverageMap.get('DL-AUTO-77234') || null, read: false },
    { type: 'unused', severity: 'tip', title: 'Unused benefit: Section 75 chargeback awareness', detail: 'Your Barclaycard Avios Plus gives joint liability with the retailer for any £100–£30,000 purchase. Use it for big-ticket items or anything you might need to dispute later.', date: '2026-03-01', coverageId: coverageMap.get('BARCLAY-AVIOS-4821') || null, read: true },
    { type: 'gap', severity: 'warning', title: 'No subsidence add-on detected', detail: "Your Aviva home policy doesn't include subsidence as standard. If your property is on London clay or in a high-risk postcode, consider adding it at renewal.", date: '2026-01-15', coverageId: coverageMap.get('AVV-HOME-55198') || null, read: true },
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
