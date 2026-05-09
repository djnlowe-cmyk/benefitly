import { notFound, unauthorized } from 'next/navigation';
import { auth } from './auth';

// v1 admin pattern: comma-separated allowlist in ADMIN_USER_EMAILS. We
// 404 (not 403) for non-admin authed users so the admin surface stays
// invisible to the rest of the userbase. Revisit when an agent/role
// model lands.
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_USER_EMAILS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export type AdminSession = { userId: string; email: string };

export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email ?? null;
  if (!userId || !email) {
    unauthorized();
  }
  if (!isAdminEmail(email)) {
    notFound();
  }
  return { userId, email };
}
