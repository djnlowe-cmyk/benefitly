import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';
import {
  buildAccountExportZip,
  checkExportRateLimit,
  EXPORT_AUDIT_ACTION,
} from '../src/lib/account-export';

let tmpRoot: string;
let prisma: PrismaClient;
let dbUrl: string;

before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'benefitly-export-test-'));
  const dbPath = join(tmpRoot, 'test.db');
  dbUrl = `file:${dbPath}`;

  // Apply schema to the temp DB (avoids needing migration history alignment).
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });

  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

async function seedUserWithEverything() {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: 'Test User',
      passwordHash: 'not-a-real-hash',
    },
  });

  const docPath = join(tmpRoot, `doc-${user.id}.pdf`);
  const docBlob = Buffer.from('%PDF-1.4 fake content for the export test\n');
  writeFileSync(docPath, docBlob);

  const document = await prisma.document.create({
    data: {
      filename: 'policy.pdf',
      mimeType: 'application/pdf',
      size: docBlob.byteLength,
      storagePath: docPath,
      userId: user.id,
      parsedData: JSON.stringify({ provider: 'Acme', type: 'Health' }),
      confidence: 0.95,
    },
  });

  await prisma.coverage.create({
    data: {
      provider: 'Acme',
      type: 'Health',
      category: 'health',
      covered: JSON.stringify(['self']),
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      premium: 100,
      userId: user.id,
      documentId: document.id,
    },
  });

  await prisma.alert.create({
    data: {
      type: 'renewal',
      severity: 'medium',
      title: 'Renewal soon',
      detail: 'Your policy renews next month.',
      date: '2026-12-01',
      userId: user.id,
    },
  });

  await prisma.transaction.create({
    data: {
      date: '2026-05-01',
      merchant: 'Pharmacy',
      amount: 12.5,
      card: 'Visa',
      cardType: 'credit',
      category: 'health',
      coverageStatus: 'covered',
      userId: user.id,
    },
  });

  await prisma.asset.create({
    data: {
      name: 'Bike',
      category: 'transport',
      value: 800,
      purchaseDate: '2025-06-15',
      userId: user.id,
    },
  });

  await prisma.claim.create({
    data: {
      incident: 'Bike theft',
      date: '2026-04-20',
      provider: 'Acme',
      category: 'home',
      userId: user.id,
    },
  });

  await prisma.familyMember.create({
    data: {
      name: 'Spouse',
      relation: 'partner',
      userId: user.id,
    },
  });

  return { user, document, docBlob };
}

const EXPECTED_JSON_ENTRIES = [
  'README.txt',
  'account.json',
  'coverages.json',
  'documents.json',
  'alerts.json',
  'transactions.json',
  'assets.json',
  'claims.json',
  'family-members.json',
];

test('buildAccountExportZip includes every user-scoped table and the original blob', async () => {
  const { user, document, docBlob } = await seedUserWithEverything();

  const result = await buildAccountExportZip(user.id, prisma);
  assert.equal(result.documentCount, 1);
  assert.equal(result.documentReadFailures, 0);
  assert.ok(result.byteCount > 0);

  const zip = await JSZip.loadAsync(result.buffer);
  for (const name of EXPECTED_JSON_ENTRIES) {
    assert.ok(zip.file(name), `expected ZIP entry: ${name}`);
  }

  const accountJson = JSON.parse(await zip.file('account.json')!.async('string'));
  assert.equal(accountJson.id, user.id);
  assert.equal(accountJson.email, user.email);
  assert.equal(accountJson.passwordHash, undefined, 'passwordHash must not leak');

  const coveragesJson = JSON.parse(await zip.file('coverages.json')!.async('string'));
  assert.equal(coveragesJson.length, 1);
  assert.equal(coveragesJson[0].userId, user.id);

  const docEntry = zip.file(`documents/${document.id}.pdf`);
  assert.ok(docEntry, 'expected original document blob in ZIP');
  const blobOut = await docEntry!.async('nodebuffer');
  assert.equal(Buffer.compare(blobOut, docBlob), 0, 'document blob roundtrips');
});

test('buildAccountExportZip records a MISSING marker if blob is unreadable', async () => {
  const user = await prisma.user.create({
    data: {
      email: `missing-${Date.now()}@example.com`,
      name: 'Missing Blob User',
      passwordHash: 'x',
    },
  });
  const document = await prisma.document.create({
    data: {
      filename: 'gone.pdf',
      mimeType: 'application/pdf',
      size: 0,
      storagePath: '/definitely/does/not/exist.pdf',
      userId: user.id,
    },
  });

  const result = await buildAccountExportZip(user.id, prisma);
  assert.equal(result.documentReadFailures, 1);

  const zip = await JSZip.loadAsync(result.buffer);
  assert.ok(zip.file(`documents/${document.id}.MISSING.txt`), 'expected MISSING marker');
});

test('checkExportRateLimit allows first export and blocks within an hour', async () => {
  const user = await prisma.user.create({
    data: {
      email: `rate-${Date.now()}@example.com`,
      name: 'Rate Limit User',
      passwordHash: 'x',
    },
  });

  const first = await checkExportRateLimit(user.id, prisma);
  assert.equal(first.allowed, true);

  await prisma.auditLog.create({
    data: { userId: user.id, action: EXPORT_AUDIT_ACTION, byteCount: 42 },
  });

  const second = await checkExportRateLimit(user.id, prisma);
  assert.equal(second.allowed, false);
  if (second.allowed === false) {
    assert.ok(second.retryAfterSeconds > 0);
    assert.ok(second.retryAfterSeconds <= 3600);
  }

  // Backdate the audit row past the rate-limit window.
  await prisma.auditLog.updateMany({
    where: { userId: user.id, action: EXPORT_AUDIT_ACTION },
    data: { requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  });

  const third = await checkExportRateLimit(user.id, prisma);
  assert.equal(third.allowed, true);
});
