import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';

import { runExport } from '../../scripts/dsr-export';

const prisma = new PrismaClient();

let tmp: string;
let user1Id: string;
let user2Id: string;
let docFsPath: string;

const DOC_BODY = Buffer.from('the operator-DSR-test PDF body — keep me\n');

beforeEach(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), 'dsr-export-test-'));
  docFsPath = path.join(tmp, 'policy.pdf');
  writeFileSync(docFsPath, DOC_BODY);

  const u1 = await prisma.user.create({
    data: {
      email: 'dsr-target@example.test',
      name: 'DSR Target',
      passwordHash: 'hash-target-supersecret',
      familyMembers: { create: [{ name: 'Spouse', relation: 'spouse' }] },
      coverages: {
        create: [
          {
            provider: 'Bupa',
            type: 'PMI',
            category: 'health',
            covered: '["DSR Target"]',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
        ],
      },
      alerts: {
        create: [
          {
            type: 'renewal',
            severity: 'medium',
            title: 'Coverage renews soon',
            detail: 'Bupa renews 2025-12-31',
            date: '2025-12-01',
          },
        ],
      },
      transactions: {
        create: [
          {
            date: '2025-04-01',
            merchant: 'Boots',
            amount: 12.5,
            card: 'Barclaycard',
            cardType: 'credit',
            category: 'health',
            coverageStatus: 'unknown',
          },
        ],
      },
      assets: {
        create: [
          {
            name: 'MacBook Pro',
            category: 'electronics',
            value: 2499,
            purchaseDate: '2024-03-10',
          },
        ],
      },
      claims: {
        create: [
          { incident: 'Phone screen smash', date: '2025-06-01', provider: 'AppleCare', category: 'warranty' },
        ],
      },
    },
  });
  user1Id = u1.id;

  await prisma.document.create({
    data: {
      userId: user1Id,
      filename: 'My Policy (final).pdf',
      mimeType: 'application/pdf',
      size: DOC_BODY.byteLength,
      storagePath: docFsPath,
      parsedData: '{"provider":"Bupa"}',
    },
  });

  await prisma.searchEvent.create({
    data: { userId: user1Id, query: 'is dental covered', resultCount: 3, successful: true },
  });
  await prisma.conciergeQuery.create({
    data: { userId: user1Id, query: 'how to claim', expectedAnswer: 'manual escalation' },
  });

  // A second user — none of their data may bleed into user1's export.
  const u2 = await prisma.user.create({
    data: {
      email: 'other-user@example.test',
      name: 'Other User',
      passwordHash: 'hash-other-DO-NOT-LEAK',
      coverages: {
        create: [
          {
            provider: 'Aviva-OTHER-USER-MARKER',
            type: 'Home',
            category: 'home',
            covered: '["Other"]',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
        ],
      },
      familyMembers: { create: [{ name: 'OTHER-USER-FAMILY-MARKER', relation: 'spouse' }] },
      searchEvents: { create: [{ query: 'OTHER-USER-SEARCH-MARKER', resultCount: 1, successful: true }] },
      conciergeQueries: { create: [{ query: 'OTHER-USER-CONCIERGE-MARKER' }] },
    },
  });
  user2Id = u2.id;
});

afterEach(async () => {
  // Order matters under sqlite + cascading FKs, but explicit deletes are safer
  // because tests/setup.ts only runs once per file.
  await prisma.document.deleteMany({});
  await prisma.searchEvent.deleteMany({});
  await prisma.conciergeQuery.deleteMany({});
  await prisma.coverage.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.claim.deleteMany({});
  await prisma.familyMember.deleteMany({});
  await prisma.user.deleteMany({});
  rmSync(tmp, { recursive: true, force: true });
});

async function loadZip(zipPath: string): Promise<JSZip> {
  const buf = await import('node:fs/promises').then((fs) => fs.readFile(zipPath));
  return JSZip.loadAsync(buf);
}

describe('scripts/dsr-export', () => {
  it('produces a zip whose manifest matches the seed and excludes other users', async () => {
    const result = await runExport({
      userId: user1Id,
      outDir: tmp,
      prisma,
      silent: true,
    });

    expect(result.documentsOk).toBe(1);
    expect(result.documentsFailed).toBe(0);

    const zip = await loadZip(result.zipPath);

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.userId).toBe(user1Id);
    expect(typeof manifest.generatedAt).toBe('string');
    expect(manifest.runner).toBeTypeOf('string');
    // 12-char hex truncation of sha256.
    expect(manifest.prismaSchemaHash).toMatch(/^[0-9a-f]{12}$/);
    expect(manifest.rowCounts).toEqual({
      users: 1,
      familyMembers: 1,
      coverages: 1,
      alerts: 1,
      transactions: 1,
      assets: 1,
      claims: 1,
      documents: 1,
      searchEvents: 1,
      conciergeQueries: 1,
    });

    // passwordHash must not appear in users.json.
    const usersJson = await zip.file('data/users.json')!.async('string');
    expect(usersJson).not.toContain('passwordHash');
    expect(usersJson).not.toContain('hash-target-supersecret');
    const usersParsed = JSON.parse(usersJson);
    expect(usersParsed).toHaveLength(1);
    expect(usersParsed[0].id).toBe(user1Id);

    // Local-disk Document file is present and bytes match.
    const docEntry = Object.keys(zip.files).find((p) => p.startsWith('documents/') && p.includes('__'));
    expect(docEntry).toBeDefined();
    const docBuf = await zip.file(docEntry!)!.async('nodebuffer');
    expect(docBuf.equals(DOC_BODY)).toBe(true);

    // Filename in the zip must be sanitized.
    expect(docEntry!).toMatch(/__My_Policy__final_\.pdf$/);

    const docIndex = JSON.parse(await zip.file('documents/index.json')!.async('string'));
    expect(docIndex).toHaveLength(1);
    expect(docIndex[0].zipEntry).toBe(docEntry);

    // No errors file when every document succeeded.
    expect(zip.file('documents/_errors.json')).toBeNull();

    // No bleed-through from user2 anywhere in the data files.
    const dataPaths = [
      'data/users.json',
      'data/family-members.json',
      'data/coverages.json',
      'data/alerts.json',
      'data/transactions.json',
      'data/assets.json',
      'data/claims.json',
      'data/documents.json',
      'data/search-events.json',
      'data/concierge-queries.json',
    ];
    for (const p of dataPaths) {
      const body = await zip.file(p)!.async('string');
      expect(body).not.toContain(user2Id);
      expect(body).not.toContain('OTHER-USER-FAMILY-MARKER');
      expect(body).not.toContain('Aviva-OTHER-USER-MARKER');
      expect(body).not.toContain('OTHER-USER-SEARCH-MARKER');
      expect(body).not.toContain('OTHER-USER-CONCIERGE-MARKER');
      expect(body).not.toContain('hash-other-DO-NOT-LEAK');
      expect(body).not.toContain('other-user@example.test');
    }
  });

  it('records a per-document error and continues when storagePath is unreachable', async () => {
    const ghostPath = path.join(tmp, 'does-not-exist.pdf');
    await prisma.document.create({
      data: {
        userId: user1Id,
        filename: 'ghost.pdf',
        mimeType: 'application/pdf',
        size: 0,
        storagePath: ghostPath,
      },
    });

    const result = await runExport({
      userId: user1Id,
      outDir: tmp,
      prisma,
      silent: true,
    });

    expect(result.documentsOk).toBe(1);
    expect(result.documentsFailed).toBe(1);

    const zip = await loadZip(result.zipPath);
    const errors = JSON.parse(await zip.file('documents/_errors.json')!.async('string'));
    expect(errors).toHaveLength(1);
    expect(errors[0].storagePath).toBe(ghostPath);
    expect(errors[0].reason).toMatch(/ENOENT|no such file/i);
  });

  it('rejects an unknown userId before writing a zip', async () => {
    await expect(
      runExport({ userId: 'nobody-here', outDir: tmp, prisma, silent: true }),
    ).rejects.toThrow(/User not found/);
  });
});
