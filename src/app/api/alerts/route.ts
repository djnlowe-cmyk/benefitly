import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { parseJsonBody, z } from '@/lib/validation';
import { withApiLogging, setRequestUserId } from '@/lib/apiLog';

const alertPatchSchema = z.object({
  id: z.string().min(1),
  read: z.boolean().optional(),
});

export const GET = withApiLogging(async (req: NextRequest) => {
  const session = await requireUserId();
  if (!session.ok) return session.response;
  setRequestUserId(req, session.userId);

  const alerts = await prisma.alert.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(alerts);
}, { route: 'alerts' });

export const PATCH = withApiLogging(async (req: NextRequest) => {
  const session = await requireUserId();
  if (!session.ok) return session.response;
  setRequestUserId(req, session.userId);

  const parsed = await parseJsonBody(req, alertPatchSchema);
  if (!parsed.ok) return parsed.response;
  const { id, read } = parsed.data;

  const existing = await prisma.alert.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.alert.update({
    where: { id },
    data: { read: read ?? true },
  });

  return NextResponse.json(updated);
}, { route: 'alerts' });
