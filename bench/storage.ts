// Corpus storage adapter. Two backends:
//   - local : reads PDFs from bench/corpus/<category>/<key> on disk.
//             Default for development. Corpus dir is gitignored — files
//             land via the founder-doc intake job, not commits.
//   - gcs   : reads PDFs from gs://${BENCH_GCS_BUCKET}/<category>/<key>.
//             Used by CI + nightly. Provisioned via a separate ticket
//             (governance — Coder cannot create cloud resources).
//
// The harness picks a backend via BENCH_STORAGE=local|gcs (default local).
// GCS adapter is intentionally a thin wrapper around `gcloud storage cat`
// so we don't pull in a heavyweight SDK before the bucket exists.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

export interface CorpusStorage {
  kind: 'local' | 'gcs';
  fetch(category: string, storageKey: string): Promise<Buffer>;
}

export function localStorage(rootDir: string): CorpusStorage {
  return {
    kind: 'local',
    async fetch(category, storageKey) {
      const path = resolve(rootDir, category, storageKey);
      return await readFile(path);
    },
  };
}

export function gcsStorage(bucket: string): CorpusStorage {
  return {
    kind: 'gcs',
    async fetch(category, storageKey) {
      const uri = `gs://${bucket}/${category}/${storageKey}`;
      return await new Promise<Buffer>((resolveBuf, reject) => {
        const proc = spawn('gcloud', ['storage', 'cat', uri], { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];
        proc.stdout.on('data', (c) => chunks.push(c));
        proc.stderr.on('data', (c) => errChunks.push(c));
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`gcloud storage cat ${uri} exited ${code}: ${Buffer.concat(errChunks).toString()}`));
            return;
          }
          resolveBuf(Buffer.concat(chunks));
        });
      });
    },
  };
}

export function pickStorage(): CorpusStorage {
  const kind = (process.env.BENCH_STORAGE ?? 'local').toLowerCase();
  if (kind === 'gcs') {
    const bucket = process.env.BENCH_GCS_BUCKET;
    if (!bucket) {
      throw new Error('BENCH_STORAGE=gcs requires BENCH_GCS_BUCKET to be set');
    }
    return gcsStorage(bucket);
  }
  const root = process.env.BENCH_LOCAL_ROOT ?? resolve(process.cwd(), 'bench/corpus');
  return localStorage(root);
}
