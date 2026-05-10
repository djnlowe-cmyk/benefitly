// GET /api/documents/[id]/content?token=<minted-token>
//
// Serves the bytes of a Document. The HMAC token issued by
// /api/documents/[id]/url binds (documentId, userId, exp); we verify the
// signature, match the path id, then stream bytes from whichever storage
// backend persisted them. The session cookie is also accepted as a fallback
// so an authenticated server-side render or a same-tab download still works
// without round-tripping through /url first.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { verifyDocumentToken } from '@/lib/documentToken';
import { getDocumentStorage } from '@/lib/storage';
import {
  ipFromHeaders,
  rekeyIfPublic,
  writeAccessLog,
} from '@/lib/documentAccess';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  let userId: string | null = null;

  if (token) {
    const verified = verifyDocumentToken(token);
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.reason === 'expired' ? 'Token expired' : 'Invalid token' },
        { status: verified.reason === 'expired' ? 410 : 401 },
      );
    }
    if (verified.claims.documentId !== id) {
      return NextResponse.json({ error: 'Token does not match document' }, { status: 403 });
    }
    userId = verified.claims.userId;
  } else {
    const session = await requireUserId();
    if (!session.ok) return session.response;
    userId = session.userId;
  }

  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc || doc.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const accessCtx = {
    ip: ipFromHeaders(req.headers),
    userAgent: req.headers.get('user-agent'),
  };

  const fresh = await rekeyIfPublic(doc, accessCtx);

  const storage = getDocumentStorage();
  const { body, contentType } = await storage.get(fresh.storagePath);

  await writeAccessLog(fresh.id, fresh.userId, 'proxy', accessCtx);

  // RFC 5987 quote the filename to survive non-ASCII bytes; fall back to a
  // plain ASCII placeholder for browsers that don't grok the * variant.
  const safeAscii = fresh.filename.replace(/[^\x20-\x7e]/g, '_');
  const dispositionFilename = encodeURIComponent(fresh.filename);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': contentType ?? fresh.mimeType,
      'Content-Length': String(body.byteLength),
      'Content-Disposition': `inline; filename="${safeAscii}"; filename*=UTF-8''${dispositionFilename}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
