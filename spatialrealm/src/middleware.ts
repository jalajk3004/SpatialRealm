// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;


  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/auth' ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // If no token, redirect to /auth
  if (!token) {
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  // Otherwise, allow request
  return NextResponse.next();
}
export const config = {
  matcher: [
    '/', '/dashboard/:path*', '/workspace/:path*',
    "/((?!auth|api|_next|favicon.ico).*)"
    ],
};