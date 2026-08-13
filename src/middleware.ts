import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

// A separate, edge-safe NextAuth instance — see auth.config.ts. Importing the
// full src/lib/auth.ts here would pull bcryptjs and Prisma into the Edge
// Function bundle and blow Vercel's 1MB size limit for no benefit, since
// middleware only ever reads an existing session, never signs one in.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ['/login', '/signup', '/invite'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAsset = pathname.startsWith('/_next') || pathname.startsWith('/api/auth') || pathname === '/manifest.webmanifest';

  if (!req.auth && !isPublic && !isAsset) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)'],
};
