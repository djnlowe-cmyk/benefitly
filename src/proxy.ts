import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/register'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return;
  }

  if (!req.auth) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
});

export const config = {
  matcher: ['/api/:path*'],
};
