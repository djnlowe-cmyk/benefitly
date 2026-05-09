import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// Tests run against a real Postgres (matching production). Provide a
// connection string via TEST_DATABASE_URL or DATABASE_URL. For local dev:
//   docker run -d --rm --name benefitly-test-pg -p 54322:5432 \
//     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=benefitly_test postgres:16-alpine
//   export TEST_DATABASE_URL=postgresql://postgres:test@localhost:54322/benefitly_test

const explicit = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!explicit || !/^postgres(ql)?:\/\//.test(explicit)) {
  throw new Error(
    'TEST_DATABASE_URL (or DATABASE_URL) must be a postgres URL. ' +
      'Run a local Postgres (see tests/setup.ts header for a one-line docker command) and export TEST_DATABASE_URL.',
  );
}

process.env.DATABASE_URL = explicit;
process.env.AUTH_SECRET ||= 'test-secret-not-for-production';
// `unauthorized()` from next/navigation guards on this env var (mirrors
// the runtime behaviour when `experimental.authInterrupts` is enabled
// in next.config.ts).
process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS ||= 'true';

// Apply all pending migrations (additive, idempotent) so tests work
// against a freshly-created DB or one that already has the schema.
execSync('npx prisma migrate deploy', {
  stdio: 'pipe',
  env: process.env,
});

// Truncate every domain table before the run so fixtures start from a
// clean slate without dropping the schema.
async function truncateAll() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`,
    );
    if (rows.length === 0) return;
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}
await truncateAll();
