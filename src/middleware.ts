import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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
