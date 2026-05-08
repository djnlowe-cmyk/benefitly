import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { getDocumentStorage } from '@/lib/storage';

export async function DELETE() {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const userId = session.userId;

  // Snapshot storage paths before the cascade — once the User row is gone, the
  // Document rows go with it and we'd lose the references to the underlying
  // blobs / files.
  const documents = await prisma.document.findMany({
    where: { userId },
    select: { storagePath: true },
  });

  await prisma.user.delete({ where: { id: userId } });

  const storage = getDocumentStorage();
  for (const { storagePath } of documents) {
    try {
      await storage.del(storagePath);
    } catch (err) {
      // A missing or already-deleted blob must not block the user delete.
      console.error('Account delete: blob cleanup failed:', err instanceof Error ? err.message : 'unknown');
    }
  }

  return NextResponse.json({ ok: true });
}
