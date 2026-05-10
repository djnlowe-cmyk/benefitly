import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { ensureRenewalAlert } from '@/lib/alerts/renewal';
import { parseJsonBody } from '@/lib/validation';
import { coveragePatchSchema } from '@/lib/schemas/coverage';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function serialise(coverage: {
  covered: string;
  exclusions: string;
  [k: string]: unknown;
}) {
  return {
    ...coverage,
    covered: JSON.parse(coverage.covered),
    exclusions: JSON.parse(coverage.exclusions),
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  const coverage = await prisma.coverage.findFirst({
    where: { id, userId: session.userId },
    include: {
      document: {
        select: { id: true, filename: true, mimeType: true },
      },
    },
  });
  if (!coverage) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { document, ...rest } = coverage;
  // No `url` field — the storage URL is private and only ever materialised
  // via /api/documents/[id]/url, which authenticates the caller and emits an
  // audit log. See ALI-145 / DPIA R-1.
  const safeDocument = document
    ? {
        id: document.id,
        filename: document.filename,
        mimeType: document.mimeType,
      }
    : null;

  return NextResponse.json({ ...serialise(rest), document: safeDocument });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  const existing = await prisma.coverage.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = await parseJsonBody(req, coveragePatchSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const data: Record<string, unknown> = {};

  if ('provider' in body) data.provider = body.provider;
  if ('type' in body) data.type = body.type;
  if ('category' in body) data.category = body.category;
  if ('policyNo' in body) data.policyNo = body.policyNo || null;
  if ('status' in body) data.status = body.status;
  if ('statusLabel' in body) data.statusLabel = body.statusLabel;
  if ('covered' in body) data.covered = JSON.stringify(body.covered || []);
  if ('startDate' in body) data.startDate = body.startDate;
  if ('endDate' in body) data.endDate = body.endDate;
  if ('premium' in body) data.premium = body.premium ?? 0;
  if ('deductible' in body) data.deductible = body.deductible ?? null;
  if ('oopMax' in body) data.oopMax = body.oopMax ?? null;
  if ('coverageLimit' in body) data.coverageLimit = body.coverageLimit ?? null;
  if ('coInsurance' in body) data.coInsurance = body.coInsurance ?? null;
  if ('exclusions' in body) data.exclusions = JSON.stringify(body.exclusions || []);
  if ('claimPhone' in body) data.claimPhone = body.claimPhone ?? null;
  if ('claimUrl' in body) data.claimUrl = body.claimUrl ?? null;
  if ('summary' in body) data.summary = body.summary ?? null;
  if ('confidence' in body) data.confidence = body.confidence ?? null;

  const updated = await prisma.coverage.update({ where: { id }, data });

  if ('endDate' in body) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { country: true, currency: true },
    });
    await ensureRenewalAlert(prisma, {
      coverage: {
        id: updated.id,
        provider: updated.provider,
        type: updated.type,
        endDate: updated.endDate,
      },
      userId: session.userId,
      region: user ?? undefined,
    });
  }

  return NextResponse.json(serialise(updated));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  const existing = await prisma.coverage.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.coverage.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
