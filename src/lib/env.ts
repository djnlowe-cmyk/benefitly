// Boot-time environment validation. Imported transitively from src/lib/db.ts
// and src/lib/auth.ts so missing required vars fail fast at module-load time
// (visible in Vercel build logs) rather than at first request.
//
// Required vars throw. Optional vars log a one-line warning the first time the
// module loads, so a developer running locally without an Anthropic key still
// gets a working app, just without document parsing.

const required = ['DATABASE_URL'] as const;

const requiredOneOf: Array<readonly string[]> = [
  // NextAuth v5 reads either AUTH_SECRET or NEXTAUTH_SECRET; we accept both so
  // existing .env files don't have to change. At least one must be set.
  ['AUTH_SECRET', 'NEXTAUTH_SECRET'],
];

const optional = ['ANTHROPIC_API_KEY', 'BLOB_READ_WRITE_TOKEN', 'NEXTAUTH_URL', 'SENTRY_DSN'] as const;

let validated = false;

function validate() {
  if (validated) return;
  validated = true;

  // `next build` evaluates this module while collecting page data with no
  // `.env.local` loaded. Skipping validation in that phase keeps the build
  // green for environments that only set DATABASE_URL on the runtime side.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const missing: string[] = [];
  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }
  for (const group of requiredOneOf) {
    if (!group.some((key) => process.env[key])) missing.push(group.join(' or '));
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `See .env.example for the full list and Vercel deployment notes.`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const warnings: string[] = [];
    for (const key of optional) {
      if (!process.env[key]) warnings.push(key);
    }
    if (warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[benefitly] Optional env vars not set: ${warnings.join(', ')}. ` +
          `Some features will be disabled (AI doc parsing, Vercel Blob storage).`
      );
    }
  }
}

validate();

export {};
