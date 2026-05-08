import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Set up the test database BEFORE Prisma client is imported by any test file.
// vitest setupFiles run after imports of the setup module's own dependencies but
// BEFORE the test file imports — so module-level side effects here are safe.
const projectRoot = path.join(__dirname, '..');
const tmpDir = mkdtempSync(path.join(tmpdir(), 'benefitly-test-'));
const dbFile = path.join(tmpDir, 'test.db');
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_SECRET ||= 'test-secret-not-for-production';

// Production schema declares `provider = "postgresql"` (deploy target is Neon)
// but tests use a throwaway SQLite file so they can run without a DB server.
// We materialise a sqlite-flavoured copy of the schema next to the real one
// (so prisma can still find the project's package.json) and point both
// `generate` and `db push` at it. The real schema and migrations stay
// untouched.
const realSchema = readFileSync(
  path.join(projectRoot, 'prisma', 'schema.prisma'),
  'utf8'
);
const sqliteSchema = realSchema.replace(
  /provider\s*=\s*"postgresql"/,
  'provider = "sqlite"'
);
const tmpSchema = path.join(projectRoot, 'prisma', '.test-schema.prisma');
writeFileSync(tmpSchema, sqliteSchema);

// Regenerate the client from the sqlite-flavoured schema so (a) this
// branch's columns (e.g. User.onboardingState) are typed in @prisma/client
// and (b) the runtime accepts the `file:` test URL. Concurrent agents
// share node_modules via the worktree, so this can be clobbered between
// test runs — regenerating here makes the suite self-healing.
execSync(`npx prisma generate --schema=${tmpSchema}`, {
  stdio: 'pipe',
  env: process.env,
  cwd: projectRoot,
});

execSync(
  `npx prisma db push --schema=${tmpSchema} --skip-generate --accept-data-loss`,
  { stdio: 'pipe', env: process.env, cwd: projectRoot }
);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(tmpSchema, { force: true });
});
