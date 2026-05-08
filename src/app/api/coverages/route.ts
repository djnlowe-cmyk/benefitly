import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { ensureRenewalAlert } from '@/lib/alerts/renewal';

export async function GET() {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const coverages = await prisma.coverage.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });

  const parsed = coverages.map((c) => ({
    ...c,
    covered: JSON.parse(c.covered),
    exclusions: JSON.parse(c.exclusions),
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const body = await req.json();

  const coverage = await prisma.coverage.create({
    data: {
      provider: body.provider,
      type: body.type,
      category: body.category,
      policyNo: body.policyNo || null,
      status: body.status || 'active',
      statusLabel: body.statusLabel || 'Active',
      covered: JSON.stringify(body.covered || []),
      startDate: body.startDate,
      endDate: body.endDate,
      premium: body.premium || 0,
      deductible: body.deductible ?? null,
      oopMax: body.oopMax ?? null,
      coverageLimit: body.coverageLimit || null,
      coInsurance: body.coInsurance || null,
      exclusions: JSON.stringify(body.exclusions || []),
      claimPhone: body.claimPhone || null,
      claimUrl: body.claimUrl || null,
      summary: body.summary || null,
      confidence: body.confidence ?? null,
      documentId: body.documentId || null,
      userId: session.userId,
    },
  });

  await ensureRenewalAlert(prisma, {
    coverage: {
      id: coverage.id,
      provider: coverage.provider,
      category: coverage.category,
      endDate: coverage.endDate,
    },
    userId: session.userId,
  });

  return NextResponse.json({
    ...coverage,
    covered: JSON.parse(coverage.covered),
    exclusions: JSON.parse(coverage.exclusions),
  }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const existing = await prisma.coverage.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
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
    await ensureRenewalAlert(prisma, {
      coverage: {
        id: updated.id,
        provider: updated.provider,
        category: updated.category,
        endDate: updated.endDate,
      },
      userId: session.userId,
    });
  }

  return NextResponse.json({
    ...updated,
    covered: JSON.parse(updated.covered),
    exclusions: JSON.parse(updated.exclusions),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const existing = await prisma.coverage.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.coverage.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
