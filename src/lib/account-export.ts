import { readFile } from 'fs/promises';
import { extname } from 'path';
import JSZip from 'jszip';
import type { AuditLog, PrismaClient } from '@prisma/client';

export const EXPORT_AUDIT_ACTION = 'account_export';
export const EXPORT_RATE_LIMIT_MS = 60 * 60 * 1000;

export type AuditOutcome = 'started' | 'success' | 'failure';

export type AuditMetadata = {
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  documentCount?: number;
  documentReadFailures?: number;
  error?: string;
};

export function encodeAuditMetadata(meta: AuditMetadata): string {
  return JSON.stringify(meta);
}

export function decodeAuditMetadata(raw: string | null | undefined): AuditMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditMetadata;
  } catch {
    return null;
  }
}

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export function extractRequestContext(req: Request): RequestContext {
  const fwd = req.headers.get('x-forwarded-for');
  // x-forwarded-for can be a comma-separated list ("client, proxy1, proxy2");
  // the left-most entry is the originating client.
  const ipAddress = fwd ? fwd.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? undefined);
  const userAgent = req.headers.get('user-agent') ?? undefined;
  return {
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  };
}

export const README_TEXT = `Benefitly — your data export
=============================

This ZIP contains a copy of the data we hold about your account, exported under
UK GDPR Article 15 (right of access) and Article 20 (right to data portability).

Contents:
- account.json         Your user record (no password hashes or session tokens).
- coverages.json       All Coverage rows you have created or uploaded.
- documents.json       Metadata for every Document you have uploaded
                       (the original files are in documents/<id>.<ext>).
- documents/           Original uploaded files, where retrievable.
- alerts.json          Renewal/coverage alerts on your account.
- transactions.json    Transaction rows linked to your account.
- assets.json          Asset rows linked to your account.
- claims.json          Claim rows linked to your account.
- family-members.json  Family member rows linked to your account.

Questions about this export, or about how we handle your data, should go to
privacy@benefitly.example. Please reference the requestedAt timestamp in your
account audit log.
`;

type StripUserPick = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AccountExportResult = {
  buffer: Buffer;
  byteCount: number;
  documentCount: number;
  documentReadFailures: number;
};

function jsonEntry(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function safeExt(filename: string, mimeType: string): string {
  const ext = extname(filename || '').toLowerCase();
  if (ext) return ext;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.bin';
}

export async function buildAccountExportZip(
  userId: string,
  prisma: PrismaClient,
): Promise<AccountExportResult> {
  const [
    user,
    coverages,
    documents,
    alerts,
    transactions,
    assets,
    claims,
    familyMembers,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<StripUserPick | null>,
    prisma.coverage.findMany({ where: { userId } }),
    prisma.document.findMany({ where: { userId } }),
    prisma.alert.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.claim.findMany({ where: { userId } }),
    prisma.familyMember.findMany({ where: { userId } }),
  ]);

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const zip = new JSZip();
  zip.file('README.txt', README_TEXT);
  zip.file('account.json', jsonEntry(user));
  zip.file('coverages.json', jsonEntry(coverages));
  zip.file(
    'documents.json',
    jsonEntry(
      documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        size: d.size,
        parsedData: d.parsedData,
        confidence: d.confidence,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    ),
  );
  zip.file('alerts.json', jsonEntry(alerts));
  zip.file('transactions.json', jsonEntry(transactions));
  zip.file('assets.json', jsonEntry(assets));
  zip.file('claims.json', jsonEntry(claims));
  zip.file('family-members.json', jsonEntry(familyMembers));

  let documentReadFailures = 0;
  for (const doc of documents) {
    try {
      const blob = await readFile(doc.storagePath);
      zip.file(`documents/${doc.id}${safeExt(doc.filename, doc.mimeType)}`, blob);
    } catch (err) {
      documentReadFailures += 1;
      console.warn(
        `[account-export] could not read document ${doc.id} at ${doc.storagePath}:`,
        err,
      );
      zip.file(
        `documents/${doc.id}.MISSING.txt`,
        `The original file for document ${doc.id} (${doc.filename}) could not be retrieved at export time. Contact privacy@benefitly.example if you need a manual copy.`,
      );
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return {
    buffer,
    byteCount: buffer.byteLength,
    documentCount: documents.length,
    documentReadFailures,
  };
}

export async function checkExportRateLimit(
  userId: string,
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const cutoff = new Date(now.getTime() - EXPORT_RATE_LIMIT_MS);
  const last = await prisma.auditLog.findFirst({
    where: {
      userId,
      action: EXPORT_AUDIT_ACTION,
      requestedAt: { gte: cutoff },
    },
    orderBy: { requestedAt: 'desc' },
    select: { requestedAt: true },
  });
  if (!last) return { allowed: true };
  const elapsed = now.getTime() - last.requestedAt.getTime();
  const retryAfterMs = Math.max(0, EXPORT_RATE_LIMIT_MS - elapsed);
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
}

// Single-process serialization for the rate-limit gate + audit-row write.
// Two concurrent GETs would otherwise both pass `checkExportRateLimit` before
// either created the audit row that flips the gate. Single-instance only —
// not durable across replicas, but that matches our planned topology (single
// SQLite-backed Next.js process). If we ever go multi-instance, swap this for
// a serializable transaction or a unique partial index.
const reservationLocks = new Map<string, Promise<unknown>>();

async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prior = reservationLocks.get(userId);
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  reservationLocks.set(userId, next);
  try {
    if (prior) {
      await prior.catch(() => {});
    }
    return await fn();
  } finally {
    release();
    if (reservationLocks.get(userId) === next) {
      reservationLocks.delete(userId);
    }
  }
}

export type ReserveExportSlotResult =
  | { allowed: true; auditRow: AuditLog }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Atomically check the rate-limit and write the "started" audit row.
 * Holding the per-user lock across both steps closes the TOCTOU window
 * where two concurrent callers both passed the gate before either wrote
 * the row that would have flipped it.
 */
export async function reserveExportSlot(
  userId: string,
  prisma: PrismaClient,
  context: RequestContext = {},
  nowOverride?: Date,
): Promise<ReserveExportSlotResult> {
  return withUserLock(userId, async () => {
    // Capture `now` inside the lock, not at call time: a queued caller may
    // have waited milliseconds for the prior reservation, and reading the
    // wall clock here keeps the rate-limit window aligned with the audit row
    // about to be (or just) written.
    const now = nowOverride ?? new Date();
    const rate = await checkExportRateLimit(userId, prisma, now);
    if (!rate.allowed) return rate;

    const auditRow = await prisma.auditLog.create({
      data: {
        userId,
        action: EXPORT_AUDIT_ACTION,
        byteCount: 0,
        metadata: encodeAuditMetadata({
          outcome: 'started',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
      },
    });
    return { allowed: true, auditRow };
  });
}
