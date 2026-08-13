import type { NextAuthConfig } from 'next-auth';

/**
 * The edge-safe half of the Auth.js config — no providers, so no bcryptjs or
 * Prisma. Middleware runs on Vercel's Edge Runtime with a 1MB bundle cap;
 * pulling the Credentials provider's Node-only dependencies in there pushes it
 * over that limit. `src/lib/auth.ts` extends this with the real provider for
 * everywhere else (the API route handler, server actions); `middleware.ts`
 * builds its own lightweight instance directly from this config, just to
 * read/verify the session cookie, which needs none of that.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  // Off Vercel, Auth.js rejects requests whose Host header it doesn't recognise
  // unless told to trust it. Safe here: this app always sits behind a single
  // known origin (AUTH_URL), never proxies arbitrary hosts.
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === 'string') {
        session.user.id = token.userId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
