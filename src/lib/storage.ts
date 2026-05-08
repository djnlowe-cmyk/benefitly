// Two-backend storage abstraction for uploaded documents.
//
// On Vercel the deployment filesystem is read-only, so any write to a path
// under process.cwd() throws EROFS at request time. When BLOB_READ_WRITE_TOKEN
// is present we use Vercel Blob; otherwise we fall back to local disk under
// `./uploads/{userId}/`, which is the dev experience.

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export interface PutResult {
  // Stable path stored on Document.storagePath. For Vercel Blob this is the
  // full Blob URL; for local disk it is the absolute filesystem path. Callers
  // treat it as opaque.
  storagePath: string;
  // Public URL or null when no public URL exists (local disk in dev).
  url: string | null;
}

export interface DocumentStorage {
  put(input: {
    userId: string;
    filename: string;
    contentType: string;
    body: Buffer;
  }): Promise<PutResult>;
}

const LOCAL_UPLOAD_DIR = join(process.cwd(), 'uploads');

const localDiskStorage: DocumentStorage = {
  async put({ userId, filename, body }) {
    const userDir = join(LOCAL_UPLOAD_DIR, userId);
    await mkdir(userDir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filepath = join(userDir, `${Date.now()}-${safeName}`);
    await writeFile(filepath, body);
    return { storagePath: filepath, url: null };
  },
};

const vercelBlobStorage: DocumentStorage = {
  async put({ userId, filename, contentType, body }) {
    // Imported dynamically so dev environments that don't install the optional
    // @vercel/blob package can still boot.
    const { put } = await import('@vercel/blob');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `users/${userId}/${Date.now()}-${safeName}`;
    const result = await put(key, body, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { storagePath: result.url, url: result.url };
  },
};

let cached: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
  if (cached) return cached;
  cached = process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobStorage : localDiskStorage;
  return cached;
}
