/**
 * Backend-for-frontend proxy for /api/v1/*.
 *
 * Everything the browser sends goes through here so that access and refresh
 * tokens live in httpOnly cookies instead of JavaScript-reachable storage. The
 * upstream contract is unchanged: this forwards to the API Gateway verbatim and
 * only moves tokens out of the response body into cookies.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { handleMock } from '@/lib/auth/mock-gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';
const MFA = 'mfa_token';

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
const MFA_MAX_AGE = 3 * 60;

const UPSTREAM = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
const USE_MOCK = process.env.AUTH_MOCK === '1' && process.env.NODE_ENV !== 'production';

/** Paths that carry the short-lived MFA ticket rather than a session. */
const MFA_PATHS = new Set(['auth/mfa/challenge', 'auth/mfa/verify']);
/** Paths that must never trigger a refresh-and-retry (they are the way in). */
const NO_REFRESH = new Set([
  'auth/login',
  'auth/register',
  'auth/otp/send',
  'auth/otp/verify',
  'auth/token/refresh',
  'auth/password/forgot',
  'auth/password/reset',
  ...MFA_PATHS,
]);

interface Upstream {
  status: number;
  body: { data?: unknown; meta?: Record<string, unknown>; errors?: unknown[] };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

async function callUpstream(
  path: string,
  method: string,
  body: BodyInit | undefined,
  headers: Record<string, string>
): Promise<Upstream> {
  if (USE_MOCK) {
    const readBody = async (): Promise<Record<string, unknown>> => {
      if (typeof body === 'string') {
        try {
          return JSON.parse(body) as Record<string, unknown>;
        } catch {
          return {};
        }
      }
      if (body instanceof FormData) return Object.fromEntries(body.entries());
      return {};
    };
    const result = await handleMock(path, method, readBody, new Headers(headers));
    return { status: result.status, body: result.body };
  }

  if (!UPSTREAM) {
    return {
      status: 503,
      body: { data: null, errors: [{ error_code: 'SERVER_ERROR' }] },
    };
  }

  const response = await fetch(`${UPSTREAM}/api/v1/${path}`, {
    method,
    headers,
    body,
    cache: 'no-store',
  });
  let parsed: Upstream['body'] = { data: null };
  try {
    parsed = (await response.json()) as Upstream['body'];
  } catch {
    parsed = { data: null, errors: [{ error_code: 'SERVER_ERROR' }] };
  }
  return { status: response.status, body: parsed };
}

async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const path = segments.join('/');
  const method = request.method;

  const accessToken = request.cookies.get(ACCESS)?.value;
  const refreshToken = request.cookies.get(REFRESH)?.value;
  const mfaToken = request.cookies.get(MFA)?.value;

  // Build the outgoing body. Refresh and logout take their token from the
  // cookie, so the browser never has to hold or send one.
  let body: BodyInit | undefined;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const contentType = request.headers.get('content-type') ?? '';

  if (method !== 'GET') {
    if (path === 'auth/token/refresh' || path === 'auth/logout') {
      body = JSON.stringify({ refresh_token: refreshToken ?? '' });
      headers['Content-Type'] = 'application/json';
    } else if (contentType.startsWith('multipart/form-data')) {
      body = await request.formData();
    } else {
      body = await request.text();
      headers['Content-Type'] = 'application/json';
    }
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (MFA_PATHS.has(path) && mfaToken) headers['x-mfa-token'] = mfaToken;

  let result = await callUpstream(path, method, body, headers);
  let rotated: { access?: string; refresh?: string } | null = null;

  // One refresh attempt, never more: a failed refresh falls through as a 401
  // and the client is sent to sign in again, so no request can loop.
  if (result.status === 401 && refreshToken && !NO_REFRESH.has(path)) {
    const refreshed = await callUpstream(
      'auth/token/refresh',
      'POST',
      JSON.stringify({ refresh_token: refreshToken }),
      { Accept: 'application/json', 'Content-Type': 'application/json' }
    );
    const payload = (refreshed.body.data ?? {}) as Record<string, unknown>;
    if (refreshed.status === 200 && typeof payload.access_token === 'string') {
      rotated = {
        access: payload.access_token,
        refresh: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
      };
      headers.Authorization = `Bearer ${rotated.access}`;
      result = await callUpstream(path, method, body, headers);
    }
  }

  // Strip every token out of the payload before it reaches the browser.
  const data = (result.body.data ?? null) as Record<string, unknown> | null;
  const issued: Record<string, string> = {};
  if (data && typeof data === 'object') {
    for (const key of [ACCESS, REFRESH, MFA]) {
      const value = data[key];
      if (typeof value === 'string') issued[key] = value;
      delete data[key];
    }
  }

  const response = NextResponse.json(
    { data, meta: result.body.meta ?? {}, errors: result.body.errors ?? [] },
    { status: result.status }
  );

  if (rotated?.access) response.cookies.set(ACCESS, rotated.access, cookieOptions(ACCESS_MAX_AGE));
  if (rotated?.refresh) {
    response.cookies.set(REFRESH, rotated.refresh, cookieOptions(REFRESH_MAX_AGE));
  }
  if (issued[ACCESS]) response.cookies.set(ACCESS, issued[ACCESS], cookieOptions(ACCESS_MAX_AGE));
  if (issued[REFRESH]) {
    response.cookies.set(REFRESH, issued[REFRESH], cookieOptions(REFRESH_MAX_AGE));
  }
  if (issued[MFA]) response.cookies.set(MFA, issued[MFA], cookieOptions(MFA_MAX_AGE));

  // A completed sign-in supersedes the MFA ticket; so does signing out.
  const signedIn = Boolean(issued[ACCESS]);
  if (path === 'auth/logout' || signedIn) response.cookies.delete(MFA);
  if (path === 'auth/logout' || (result.status === 401 && !NO_REFRESH.has(path) && !signedIn)) {
    response.cookies.delete(ACCESS);
    response.cookies.delete(REFRESH);
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
