import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from './db';

/**
 * Email + password auth. JWT session strategy, not database sessions — a
 * Credentials provider can't use next-auth's database session/adapter flow, and a
 * JWT is enough for what this app needs. Magic-link sign-in is the more inviting
 * option for non-technical workers and is a natural fast-follow once transactional
 * email (Resend) is wired up; password auth is what works without that dependency.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  // Off Vercel, Auth.js rejects requests whose Host header it doesn't recognise
  // unless told to trust it. Safe here: this app always sits behind a single
  // known origin (AUTH_URL), never proxies arbitrary hosts.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') return null;

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
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
});
