import { execSync } from 'node:child_process';

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

// Reset the schema before each run so fixtures start from a clean slate.
execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', {
  stdio: 'pipe',
  env: process.env,
});
