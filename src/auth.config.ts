import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
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
