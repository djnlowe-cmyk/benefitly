import { NextResponse } from 'next/server';
import { auth } from './auth';

export type RequireUserResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireUserId(): Promise<RequireUserResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    };
  }
  return { ok: true, userId };
}
