import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  // NextAuth v5 rejects unknown hosts by default. In dev/test the request host
  // is localhost (or a preview tunnel) which trips UntrustedHost; in prod the
  // platform host header is the legit check, so leave it strict there.
  trustHost: process.env.NODE_ENV !== 'production',
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as unknown as { id: string }).id = token.userId as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
