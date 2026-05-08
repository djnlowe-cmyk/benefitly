import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';

export async function DELETE() {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  try {
    await prisma.user.delete({ where: { id: auth.userId } });
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    console.error('Account delete failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
