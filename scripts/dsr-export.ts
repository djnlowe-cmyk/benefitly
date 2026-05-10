// Admin DSR Art. 15 export — produces a single zip with everything Benefitly
// holds about a single user, for an operator to deliver in response to a Right
// of Access request. Canonical procedure lives in the ALI-142 SOP document
// (`/ALI/issues/ALI-142#document-dsr-art15-sop`); do not duplicate it here.
//
// Usage:
//   npx tsx scripts/dsr-export.ts <userId> [--out <path>]
//
// Default output: ./dsr-exports/<userId>-<ISO timestamp>.zip
//
// jszip chosen over archiver: no native build, dev-friendly Buffer API, and a
// per-user export comfortably fits in memory at our scale.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { userInfo } from 'node:os';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';

export const SCHEMA_VERSION = 1;

export type ExportResult = {
  zipPath: string;
  byteCount: number;
  rowCounts: Record<string, number>;
  documentsOk: number;
  documentsFailed: number;
};

type DocumentError = { documentId: string; storagePath: string; reason: string };

function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isoStamp(d: Date = new Date()): string {
  // Filesystem-safe ISO-8601 — colons replaced so Windows operators can copy.
  return d.toISOString().replace(/[:.]/g, '-');
}

async function hashSchemaFile(): Promise<string | null> {
  try {
    const body = await readFile(resolve(process.cwd(), 'prisma/schema.prisma'));
    return createHash('sha256').update(body).digest('hex').slice(0, 12);
  } catch {
    return null;
  }
}

async function readDocumentBlob(
  storagePath: string,
): Promise<{ ok: true; body: Buffer } | { ok: false; reason: string }> {
  if (/^https?:\/\//i.test(storagePath)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { ok: false, reason: 'BLOB_READ_WRITE_TOKEN not set; cannot fetch blob URL' };
    }
    try {
      // Dynamic import keeps dev environments without @vercel/blob bootable —
      // matches the pattern in src/lib/storage.ts.
      const blobMod = await import('@vercel/blob');
      // The Vercel Blob URL is publicly reachable; we still pass the token so
      // private buckets work, and to keep symmetry with src/lib/storage.ts.
      const head = await (blobMod as { head: (url: string, opts: { token?: string }) => Promise<{ url: string }> }).head(
        storagePath,
        { token: process.env.BLOB_READ_WRITE_TOKEN },
      );
      const res = await fetch(head.url);
      if (!res.ok) {
        return { ok: false, reason: `fetch failed: ${res.status} ${res.statusText}` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: true, body: buf };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
  try {
    return { ok: true, body: await readFile(storagePath) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function runExport(opts: {
  userId: string;
  outDir?: string;
  outFile?: string;
  prisma?: PrismaClient;
  // Test seam — when set the script does not write its summary to stdout.
  silent?: boolean;
}): Promise<ExportResult> {
  const { userId, silent } = opts;
  const ownsClient = !opts.prisma;
  const prisma = opts.prisma ?? new PrismaClient();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const [
      familyMembers,
      coverages,
      alerts,
      transactions,
      assets,
      claims,
      documents,
      searchEvents,
      conciergeQueries,
    ] = await Promise.all([
      prisma.familyMember.findMany({ where: { userId } }),
      prisma.coverage.findMany({ where: { userId } }),
      prisma.alert.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId } }),
      prisma.asset.findMany({ where: { userId } }),
      prisma.claim.findMany({ where: { userId } }),
      prisma.document.findMany({ where: { userId } }),
      prisma.searchEvent.findMany({ where: { userId } }),
      prisma.conciergeQuery.findMany({ where: { userId } }),
    ]);

    const rowCounts: Record<string, number> = {
      users: 1,
      familyMembers: familyMembers.length,
      coverages: coverages.length,
      alerts: alerts.length,
      transactions: transactions.length,
      assets: assets.length,
      claims: claims.length,
      documents: documents.length,
      searchEvents: searchEvents.length,
      conciergeQueries: conciergeQueries.length,
    };

    const zip = new JSZip();
    const json = (data: unknown) => JSON.stringify(data, null, 2);

    const { passwordHash: _omit, ...userOut } = user;
    void _omit;

    zip.file('data/users.json', json([userOut]));
    zip.file('data/family-members.json', json(familyMembers));
    zip.file('data/coverages.json', json(coverages));
    zip.file('data/alerts.json', json(alerts));
    zip.file('data/transactions.json', json(transactions));
    zip.file('data/assets.json', json(assets));
    zip.file('data/claims.json', json(claims));
    zip.file('data/documents.json', json(documents));
    zip.file('data/search-events.json', json(searchEvents));
    zip.file('data/concierge-queries.json', json(conciergeQueries));

    const documentIndex: Array<{
      documentId: string;
      filename: string;
      mimeType: string;
      size: number;
      storagePath: string;
      zipEntry: string | null;
    }> = [];
    const documentErrors: DocumentError[] = [];
    let documentsOk = 0;

    for (const doc of documents) {
      const safe = safeFilename(doc.filename);
      const zipEntry = `documents/${doc.id}__${safe}`;
      const result = await readDocumentBlob(doc.storagePath);
      if (result.ok) {
        zip.file(zipEntry, result.body);
        documentIndex.push({
          documentId: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          size: doc.size,
          storagePath: doc.storagePath,
          zipEntry,
        });
        documentsOk += 1;
      } else {
        documentIndex.push({
          documentId: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          size: doc.size,
          storagePath: doc.storagePath,
          zipEntry: null,
        });
        documentErrors.push({
          documentId: doc.id,
          storagePath: doc.storagePath,
          reason: result.reason,
        });
      }
    }

    zip.file('documents/index.json', json(documentIndex));
    if (documentErrors.length > 0) {
      zip.file('documents/_errors.json', json(documentErrors));
    }

    zip.file(
      'manifest.json',
      json({
        userId,
        generatedAt: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        runner: userInfo().username,
        prismaSchemaHash: await hashSchemaFile(),
        rowCounts,
      }),
    );

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const zipPath = opts.outFile
      ? resolve(opts.outFile)
      : resolve(opts.outDir ?? './dsr-exports', `${userId}-${isoStamp()}.zip`);
    await mkdir(dirname(zipPath), { recursive: true });
    await writeFile(zipPath, buffer);

    if (!silent) {
      // Rowcounts only — never log document filenames or user emails per the
      // privacy lens in the issue.
      for (const [name, count] of Object.entries(rowCounts)) {
        process.stdout.write(`${name}: ${count} rows\n`);
      }
      process.stdout.write(
        `documents: ${documentsOk} ok, ${documentErrors.length} failed\n`,
      );
      process.stdout.write(`zip: ${zipPath}\n`);
    }

    return {
      zipPath,
      byteCount: buffer.byteLength,
      rowCounts,
      documentsOk,
      documentsFailed: documentErrors.length,
    };
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

function parseArgs(argv: string[]): { userId: string; outFile?: string } {
  const args = argv.slice(2);
  let userId: string | undefined;
  let outFile: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--out') {
      outFile = args[i + 1];
      if (!outFile) throw new Error('--out requires a path');
      i += 1;
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: npx tsx scripts/dsr-export.ts <userId> [--out <path>]\n',
      );
      process.exit(0);
    } else if (!userId) {
      userId = a;
    } else {
      throw new Error(`unexpected argument: ${a}`);
    }
  }

  if (!userId) {
    throw new Error('userId is required. Usage: npx tsx scripts/dsr-export.ts <userId> [--out <path>]');
  }
  return { userId, outFile };
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /scripts[\\/]dsr-export\.ts$/.test(process.argv[1]);

if (invokedDirectly) {
  (async () => {
    try {
      const { userId, outFile } = parseArgs(process.argv);
      await runExport({ userId, outFile });
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`dsr-export failed: ${msg}\n`);
      process.exit(1);
    }
  })();
}
