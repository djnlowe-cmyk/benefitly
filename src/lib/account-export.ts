import { readFile } from 'fs/promises';
import { extname } from 'path';
import JSZip from 'jszip';
import type { PrismaClient } from '@prisma/client';

export const EXPORT_AUDIT_ACTION = 'account_export';
export const EXPORT_RATE_LIMIT_MS = 60 * 60 * 1000;

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
