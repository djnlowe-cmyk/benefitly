// Two-backend storage abstraction for uploaded documents.
//
// Documents are private by default (DPIA R-1, ALI-139): we never persist a
// public URL anywhere. The storagePath we store on Document is a stable,
// backend-specific opaque locator:
//   - Vercel Blob: the blob *key* (e.g. "users/abc/1700000000000-policy.pdf").
//     Bytes are fetched server-side via @vercel/blob#get with access:'private'.
//   - Local disk: the absolute filesystem path under ./uploads/{userId}/.
//
// On Vercel the deployment filesystem is read-only, so any write to a path
// under process.cwd() throws EROFS at request time. When BLOB_READ_WRITE_TOKEN
// is present we use Vercel Blob; otherwise we fall back to local disk under
// `./uploads/{userId}/`, which is the dev experience.

import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';

export interface PutResult {
  // Backend-specific opaque locator persisted as Document.storagePath. Callers
  // must NOT treat this as a URL — the value is intentionally not directly
  // fetchable by the browser.
  storagePath: string;
}

export interface GetResult {
  body: Buffer;
  contentType: string | null;
}

export interface DocumentStorage {
  put(input: {
    userId: string;
    filename: string;
    contentType: string;
    body: Buffer;
  }): Promise<PutResult>;
  get(storagePath: string): Promise<GetResult>;
  del(storagePath: string): Promise<void>;
}

const LOCAL_UPLOAD_DIR = join(process.cwd(), 'uploads');

// Existing rows from before ALI-145 stored a full https URL in storagePath
// (Vercel Blob's `result.url`). Detect those so we can lazily re-key them
// the first time we hand bytes to the client.
export function isLegacyPublicUrl(storagePath: string): boolean {
  return /^https?:\/\//i.test(storagePath);
}

async function blobImport() {
  // Imported dynamically so dev environments without @vercel/blob can boot.
  return import('@vercel/blob');
}

// A storagePath is self-identifying: Vercel Blob keys never contain a leading
// slash and never start with http(s); local-disk paths are absolute. We use
// the same delete dispatcher across backends so account-deletion still works
// on rows that span backends.
async function deleteStorageEntry(storagePath: string): Promise<void> {
  if (isLegacyPublicUrl(storagePath)) {
    const { del } = await blobImport();
    await del(storagePath, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }
  if (storagePath.startsWith('/')) {
    await rm(storagePath, { force: true });
    return;
  }
  // New private-blob keys: delete by key via the blob SDK.
  const { del } = await blobImport();
  await del(storagePath, { token: process.env.BLOB_READ_WRITE_TOKEN });
}

const localDiskStorage: DocumentStorage = {
  async put({ userId, filename, body }) {
    const userDir = join(LOCAL_UPLOAD_DIR, userId);
    await mkdir(userDir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filepath = join(userDir, `${Date.now()}-${safeName}`);
    await writeFile(filepath, body);
    return { storagePath: filepath };
  },
  async get(storagePath) {
    const body = await readFile(storagePath);
    return { body, contentType: null };
  },
  del: deleteStorageEntry,
};

const vercelBlobStorage: DocumentStorage = {
  async put({ userId, filename, contentType, body }) {
    const { put } = await blobImport();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `users/${userId}/${Date.now()}-${safeName}`;
    await put(key, body, {
      access: 'private',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { storagePath: key };
  },
  async get(storagePath) {
    const { get } = await blobImport();
    // Legacy public-URL rows: read by URL, not by key.
    const target = isLegacyPublicUrl(storagePath) ? storagePath : storagePath;
    const result = await get(target, {
      access: isLegacyPublicUrl(storagePath) ? 'public' : 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result) {
      throw new Error(`Blob not found: ${storagePath}`);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return {
      body: Buffer.concat(chunks),
      contentType: result.headers?.get?.('content-type') ?? null,
    };
  },
  del: deleteStorageEntry,
};

let cached: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
  if (cached) return cached;
  cached = process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobStorage : localDiskStorage;
  return cached;
}

// Test-only seam: lets tests inject a custom backend. Returns a restore fn.
export function __setDocumentStorageForTests(impl: DocumentStorage): () => void {
  const prev = cached;
  cached = impl;
  return () => {
    cached = prev;
  };
}
