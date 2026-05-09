import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { Coverage } from '@/types/coverage';
import { evaluateGapsDetailed } from '@/lib/gaps/evaluate';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseCoverage(row: {
  id: string;
  provider: string;
  type: string;
  category: string;
  policyNo: string | null;
  status: string;
  statusLabel: string;
  covered: string;
  startDate: string;
  endDate: string;
  premium: number;
  deductible: number | null;
  oopMax: number | null;
  coverageLimit: string | null;
  coInsurance: string | null;
  exclusions: string;
  claimPhone: string | null;
  claimUrl: string | null;
  summary: string | null;
}): Coverage {
  return {
    id: row.id,
    provider: row.provider,
    type: row.type,
    category: row.category as Coverage['category'],
    policyNo: row.policyNo,
    status: row.status as Coverage['status'],
    statusLabel: row.statusLabel,
    covered: JSON.parse(row.covered) as string[],
    startDate: row.startDate,
    endDate: row.endDate,
    premium: row.premium,
    deductible: row.deductible,
    oopMax: row.oopMax,
    coverageLimit: row.coverageLimit,
    coInsurance: row.coInsurance,
    exclusions: JSON.parse(row.exclusions) as string[],
    claimPhone: row.claimPhone,
    claimUrl: row.claimUrl,
    summary: row.summary,
  };
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // Single round-trip: target coverage + sibling list + dismissals.
  const [target, siblings, dismissals, user] = await Promise.all([
    prisma.coverage.findFirst({ where: { id, userId: session.userId } }),
    prisma.coverage.findMany({ where: { userId: session.userId } }),
    prisma.coverageGapDismissal.findMany({
      where: { userId: session.userId, coverageId: id },
      select: { gapKey: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { country: true, currency: true },
    }),
  ]);

  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsedTarget = parseCoverage(target);
  const parsedSiblings = siblings.map(parseCoverage);

  const { gaps, counters } = evaluateGapsDetailed(parsedTarget, parsedSiblings, {
    region: { country: user?.country ?? null, currency: user?.currency ?? null },
  });

  const dismissed = new Set(dismissals.map((d) => d.gapKey));
  const visibleGaps = gaps.filter((g) => !dismissed.has(g.key));

  // Observability: lightweight counter we can grep for in logs. No PII —
  // gapKey, coverageId, userId-hash-equivalent (cuid).
  for (const gap of visibleGaps) {
    console.log(`[gap_fired] coverageId=${parsedTarget.id} gapKey=${gap.key} severity=${gap.severity}`);
  }

  // Persisted equivalent of the [gap_fired] log: one row per detail-page
  // load with the count of currently-visible gaps. Fire-and-forget so a
  // write failure cannot break the user-facing read.
  prisma.coverageDetailView
    .create({
      data: {
        userId: session.userId,
        coverageId: parsedTarget.id,
        firedGapCount: visibleGaps.length,
      },
    })
    .catch((err) => {
      console.error('[coverage_detail_view] insert failed', err);
    });

  return NextResponse.json({
    ...parsedTarget,
    gaps: visibleGaps,
    gapsChecked: counters,
  });
}
