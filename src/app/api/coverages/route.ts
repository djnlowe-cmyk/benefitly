import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const coverages = await prisma.coverage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // Parse JSON fields for the client
  const parsed = coverages.map((c) => ({
    ...c,
    covered: JSON.parse(c.covered),
    exclusions: JSON.parse(c.exclusions),
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
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
      coverageLimit: body.coverageLimit || body.limit || null,
      coInsurance: body.coInsurance || null,
      exclusions: JSON.stringify(body.exclusions || []),
      claimPhone: body.claimPhone || null,
      claimUrl: body.claimUrl || null,
      summary: body.summary || null,
      confidence: body.confidence ?? null,
      documentId: body.documentId || null,
      userId,
    },
  });

  return NextResponse.json({
    ...coverage,
    covered: JSON.parse(coverage.covered),
    exclusions: JSON.parse(coverage.exclusions),
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // Verify ownership
  const existing = await prisma.coverage.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.coverage.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
