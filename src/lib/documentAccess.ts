// Helpers for the document signed-URL / proxy path. Lives in lib/ so both
// /api/documents/[id]/url and /api/documents/[id]/content can share the
// rekey + audit-log dispatch without circular imports through route files.

import type { Document } from '@prisma/client';
import prisma from '@/lib/db';
import { getDocumentStorage, isLegacyPublicUrl } from '@/lib/storage';

export type DocumentAccessMode = 'signed_url' | 'proxy' | 'rekey';

export interface AccessLogContext {
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAccessLog(
  documentId: string,
  userId: string,
  mode: DocumentAccessMode,
  ctx: AccessLogContext = {},
): Promise<void> {
  await prisma.documentAccessLog.create({
    data: {
      documentId,
      userId,
      mode,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });
}

// Lazy public→private migration. If `document.storagePath` is still a public
// blob URL from before ALI-145, fetch the bytes, upload them as a private
// blob, swap storagePath, delete the old public blob, and emit a 'rekey'
// audit row. Idempotent under concurrent requests: the database update is
// guarded by `where: { id, storagePath: <oldPath> }`, so the second writer's
// update affects 0 rows and the second old-blob delete is a no-op (Vercel
// Blob's `del` swallows 404s when the URL is already gone). Returns the
// (possibly-updated) Document.
export async function rekeyIfPublic(
  document: Document,
  ctx: AccessLogContext = {},
): Promise<Document> {
  if (!isLegacyPublicUrl(document.storagePath)) return document;
  // Vercel Blob is required to rekey: the old path is a public blob URL.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Without a token we can't migrate; leave the row alone — the content
    // proxy will still work (vercelBlobStorage.get handles legacy URLs).
    return document;
  }

  const storage = getDocumentStorage();
  const oldPath = document.storagePath;
  const { body, contentType } = await storage.get(oldPath);
  const { storagePath: newPath } = await storage.put({
    userId: document.userId,
    filename: document.filename,
    contentType: contentType ?? document.mimeType,
    body,
  });

  // Conditional update: only swap storagePath if it's still the old value.
  // Concurrent requests hitting the same legacy doc race here; the loser's
  // updateMany returns count: 0 and we discard their newly-uploaded private
  // blob via the rollback delete below.
  const updated = await prisma.document.updateMany({
    where: { id: document.id, storagePath: oldPath },
    data: { storagePath: newPath },
  });

  if (updated.count === 0) {
    // Another concurrent request beat us. Drop our just-uploaded copy so we
    // don't leave a dangling private blob behind.
    try {
      await storage.del(newPath);
    } catch {
      // Best-effort cleanup; not fatal.
    }
    const fresh = await prisma.document.findUnique({ where: { id: document.id } });
    return fresh ?? document;
  }

  // Winner: delete the old public blob exactly once.
  try {
    await storage.del(oldPath);
  } catch {
    // The public blob is already gone (or already deleted by another path);
    // not fatal — the row is the source of truth.
  }
  await writeAccessLog(document.id, document.userId, 'rekey', ctx);

  return { ...document, storagePath: newPath };
}

export function ipFromHeaders(headers: Headers): string | null {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return headers.get('x-real-ip') || null;
}
