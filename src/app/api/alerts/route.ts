import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const { id, read } = await req.json();

  const existing = await prisma.alert.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.alert.update({
    where: { id },
    data: { read: read ?? true },
  });

  return NextResponse.json(updated);
}
