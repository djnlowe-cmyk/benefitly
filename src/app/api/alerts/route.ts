import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';

export async function GET() {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const alerts = await prisma.alert.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id, read } = await req.json();

  const existing = await prisma.alert.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.alert.update({
    where: { id },
    data: { read: read ?? true },
  });

  return NextResponse.json(updated);
}
