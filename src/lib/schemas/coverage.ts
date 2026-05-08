// Single source of truth for /api/coverages request validation. Both the
// collection route (POST/PATCH ?id=) and the per-id route ([id]/PATCH) parse
// against these schemas via `parseJsonBody` so the contract — including the
// coverageLimit-as-string rule that motivated ALI-75 — stays consistent.

import { z } from '@/lib/validation';

const stringArray = z.array(z.string());
const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

export const coverageCreateSchema = z.object({
  provider: z.string().min(1),
  type: z.string().min(1),
  category: z.string().min(1),
  policyNo: nullableString,
  status: z.string().optional(),
  statusLabel: z.string().optional(),
  covered: stringArray.optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  premium: z.number().optional(),
  deductible: nullableNumber,
  oopMax: nullableNumber,
  // coverageLimit is a String? in Prisma — reject numbers explicitly.
  coverageLimit: nullableString,
  coInsurance: nullableString,
  exclusions: stringArray.optional(),
  claimPhone: nullableString,
  claimUrl: nullableString,
  summary: nullableString,
  confidence: nullableNumber,
  documentId: nullableString,
});

export const coveragePatchSchema = coverageCreateSchema.partial();

export type CoverageCreateBody = z.infer<typeof coverageCreateSchema>;
export type CoveragePatchBody = z.infer<typeof coveragePatchSchema>;
