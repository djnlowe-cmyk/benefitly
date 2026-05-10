import { handlers } from '@/lib/auth';
import { withApiLogging } from '@/lib/apiLog';

// We log around the NextAuth handlers but do not modify NextAuth internals.
// userId is intentionally not threaded — most NextAuth flows are unauthenticated
// or sit between sessions, so the slot stays null.
export const GET = withApiLogging(handlers.GET, { route: 'auth' });
export const POST = withApiLogging(handlers.POST, { route: 'auth' });
