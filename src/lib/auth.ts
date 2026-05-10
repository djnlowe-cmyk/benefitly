import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import { authConfig } from '@/auth.config';
import prisma from './db';

// Email is intentionally NOT included so credentials never reach the event store.
function reportAuthFailure() {
  Sentry.captureMessage('auth_failure', {
    level: 'warning',
    tags: { event: 'auth_failure' },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          reportAuthFailure();
          return null;
        }

        const valid = await compare(credentials.password as string, user.passwordHash);
        if (!valid) {
          reportAuthFailure();
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
