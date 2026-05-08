import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Set up the test database BEFORE Prisma client is imported by any test file.
// vitest setupFiles run after imports of the setup module's own dependencies but
// BEFORE the test file imports — so module-level side effects here are safe.
const tmpDir = mkdtempSync(path.join(tmpdir(), 'benefitly-test-'));
const dbFile = path.join(tmpDir, 'test.db');
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_SECRET ||= 'test-secret-not-for-production';

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  stdio: 'pipe',
  env: process.env,
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});
