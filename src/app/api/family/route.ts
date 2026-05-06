import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const members = await prisma.familyMember.findMany({ where: { userId } });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const { name, relation } = await req.json();

  // Enforce 5-member limit
  const count = await prisma.familyMember.count({ where: { userId } });
  if (count >= 5) {
    return NextResponse.json({ error: 'Maximum 5 family members allowed' }, { status: 400 });
  }

  const member = await prisma.familyMember.create({
    data: { name, relation, userId },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const existing = await prisma.familyMember.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.familyMember.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
