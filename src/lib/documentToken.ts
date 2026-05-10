// HMAC-signed bearer token for document content fetches.
//
// We don't have a working signed-URL primitive in @vercel/blob v2 (the only
// `getDownloadUrl` export is a `?download=1` helper, not a signed URL with an
// expiry — see ALI-145 PR description). So we mint our own short-lived token
// and serve bytes through /api/documents/[id]/content. The token is HMAC-SHA256
// over `documentId|userId|exp`; verification is constant-time. The token is a
// bearer credential — anyone with it can fetch the doc until exp — which is
// the same trust model as a signed S3/Blob URL would have.

import { createHmac, timingSafeEqual } from 'crypto';

export interface DocumentTokenClaims {
  documentId: string;
  userId: string;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 5 * 60;

function ttlSeconds(): number {
  const raw = process.env.DOC_SIGNED_URL_TTL_SECONDS;
  if (!raw) return DEFAULT_TTL_SECONDS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > DEFAULT_TTL_SECONDS) {
    // Cap at 5 minutes — the DPIA constraint, not just a default.
    return DEFAULT_TTL_SECONDS;
  }
  return n;
}

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error('AUTH_SECRET is required to mint document tokens');
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest());
}

export interface MintedDocumentToken {
  token: string;
  expiresAt: Date;
  ttlSeconds: number;
}

export function mintDocumentToken(documentId: string, userId: string): MintedDocumentToken {
  const ttl = ttlSeconds();
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const claims: DocumentTokenClaims = { documentId, userId, exp };
  const payload = b64url(JSON.stringify(claims));
  const sig = sign(payload);
  return {
    token: `${payload}.${sig}`,
    expiresAt: new Date(exp * 1000),
    ttlSeconds: ttl,
  };
}

export type VerifyTokenResult =
  | { ok: true; claims: DocumentTokenClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyDocumentToken(token: string | null | undefined): VerifyTokenResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' };
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  let claims: DocumentTokenClaims;
  try {
    claims = JSON.parse(fromB64url(payload).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    typeof claims.documentId !== 'string' ||
    typeof claims.userId !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.exp * 1000 <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claims };
}
