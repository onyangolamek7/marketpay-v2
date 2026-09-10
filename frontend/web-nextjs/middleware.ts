import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROLE_HOME } from '@/lib/auth/routes';
import type { Role } from '@/lib/auth/types';

/**
 * Edge routing only. It reads the session cookie to decide *where* to send a
 * request, never to decide what data someone may have — the API Gateway
 * verifies the token signature and enforces authorization on every call.
 */

/** Reachable without a session. */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/verify-phone',
  '/mfa',
  '/forgot-password',
  '/reset-password',
  '/ussd',
];

/** Signed in, but open to every role regardless of account state. */
const SHARED_ROUTES = ['/kyc', '/account-status', '/change-password', '/mfa/setup', '/settings'];

const ROLE_ROUTES: Record<Role, string[]> = {
  consumer: ['/dashboard/consumer', '/marketplace', '/wallet', '/orders'],
  retailer: ['/dashboard/retailer', '/marketplace', '/wallet', '/orders', '/products', '/inventory'],
  wholesaler: ['/dashboard/wholesaler', '/marketplace', '/wallet', '/orders', '/bulk-deals'],
  rider: ['/dashboard/rider', '/deliveries'],
  gov_analyst: ['/dashboard/gov-analyst', '/reports'],
  admin: ['/dashboard/admin', '/users', '/system', '/kyc-review'],
};

function matches(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

/** Reads the unverified payload for routing. Never trusted for authorization. */
function readRole(token: string): Role | null {
  try {
    const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(segment)) as { role?: string; exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return (payload.role as Role) ?? null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Shared routes are checked first: /mfa/setup needs a session even though the
  // public /mfa challenge screen sits above it.
  if (!matches(path, SHARED_ROUTES) && matches(path, PUBLIC_ROUTES)) return NextResponse.next();

  const token = request.cookies.get('access_token')?.value;
  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', path);
    return NextResponse.redirect(login);
  }

  const role = readRole(token);
  if (!role) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', path);
    const response = NextResponse.redirect(login);
    response.cookies.delete('access_token');
    return response;
  }

  if (!matches(path, SHARED_ROUTES) && !matches(path, ROLE_ROUTES[role])) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  const response = NextResponse.next();
  // Keeps a signed-out user from seeing a protected page via the back button.
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)'],
};
