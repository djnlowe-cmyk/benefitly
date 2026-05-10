// GET /api/documents/[id]/url
//
// DPIA R-1 (ALI-139): mints a short-lived (≤5 min) HMAC-signed token URL the
// browser can hand back to /api/documents/[id]/content. We use a token-based
// proxy because @vercel/blob v2 does not expose a working signed-URL primitive
// — see src/lib/documentToken.ts for the threat-model + token format.
//
// Returns 401 on no session, 404 on either "no such document" or "document
// belongs to a different user" (we do NOT reveal existence to non-owners).

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { mintDocumentToken } from '@/lib/documentToken';
import {
  ipFromHeaders,
  rekeyIfPublic,
  writeAccessLog,
} from '@/lib/documentAccess';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc || doc.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const accessCtx = {
    ip: ipFromHeaders(req.headers),
    userAgent: req.headers.get('user-agent'),
  };

  // Lazy migration of pre-ALI-145 public-URL rows. Idempotent under
  // concurrent requests; see rekeyIfPublic() for the swap-and-delete contract.
  await rekeyIfPublic(doc, accessCtx);

  const minted = mintDocumentToken(doc.id, doc.userId);
  await writeAccessLog(doc.id, doc.userId, 'signed_url', accessCtx);

  const url =
    `/api/documents/${encodeURIComponent(doc.id)}/content` +
    `?token=${encodeURIComponent(minted.token)}`;

  return NextResponse.json({
    url,
    expiresAt: minted.expiresAt.toISOString(),
    ttlSeconds: minted.ttlSeconds,
    filename: doc.filename,
    mimeType: doc.mimeType,
  });
}
