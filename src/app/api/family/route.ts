import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { parseJsonBody, z } from '@/lib/validation';

const familyCreateSchema = z.object({
  name: z.string().min(1),
  // The DB column is `relation`. Reject any other shape (e.g. `relationship`)
  // up front rather than letting Prisma surface a 500.
  relation: z.string().min(1),
});

export async function GET() {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const members = await prisma.familyMember.findMany({ where: { userId: session.userId } });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const parsed = await parseJsonBody(req, familyCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { name, relation } = parsed.data;

  const count = await prisma.familyMember.count({ where: { userId: session.userId } });
  if (count >= 5) {
    return NextResponse.json({ error: 'Maximum 5 family members allowed' }, { status: 400 });
  }

  const member = await prisma.familyMember.create({
    data: { name, relation, userId: session.userId },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const existing = await prisma.familyMember.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.familyMember.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
