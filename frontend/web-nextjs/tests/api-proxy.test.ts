// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UPSTREAM = 'http://gateway.test';

type Upstream = { status?: number; body?: unknown };

/** Loads the route fresh so it picks up the stubbed environment. */
async function loadProxy() {
  vi.resetModules();
  vi.stubEnv('API_GATEWAY_URL', UPSTREAM);
  vi.stubEnv('AUTH_MOCK', '0');
  return import('@/app/api/v1/[...path]/route');
}

function stubUpstream(responses: Record<string, Upstream | Upstream[]>) {
  const seen: string[] = [];
  const queues = new Map<string, Upstream[]>(
    Object.entries(responses).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]])
  );

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = input.toString().replace(`${UPSTREAM}/api/v1/`, '');
      seen.push(path);
      const queue = queues.get(path) ?? [];
      const next = queue.length > 1 ? queue.shift()! : (queue[0] ?? { status: 404 });
      return new Response(JSON.stringify({ data: next.body ?? null, meta: {}, errors: [] }), {
        status: next.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    })
  );
  return { seen };
}

function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.body) headers.set('content-type', 'application/json');
  return {
    req: new NextRequest(`http://localhost/api/v1/${path}`, {
      method: init.method ?? 'GET',
      body: init.body,
      headers,
    }),
    ctx: { params: Promise.resolve({ path: path.split('/') }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the /api/v1 proxy', () => {
  it('moves login tokens into httpOnly cookies and strips them from the body', async () => {
    const { POST } = await loadProxy();
    stubUpstream({
      'auth/login': {
        body: {
          mfa_required: false,
          user: { id: 'u1', role: 'consumer' },
          access_token: 'access-abc',
          refresh_token: 'refresh-abc',
        },
      },
    });

    const { req, ctx } = request('auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone_number: '+254712345678', password: 'Mombasa2024!' }),
    });
    const response = await POST(req, ctx);
    const payload = await response.json();

    expect(payload.data.access_token).toBeUndefined();
    expect(payload.data.refresh_token).toBeUndefined();
    expect(payload.data.user).toMatchObject({ id: 'u1' });
    expect(JSON.stringify(payload)).not.toContain('access-abc');

    const access = response.cookies.get('access_token');
    expect(access?.value).toBe('access-abc');
    expect(access?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe('lax');
    expect(response.cookies.get('refresh_token')?.httpOnly).toBe(true);
  });

  it('keeps the MFA ticket out of the body and sends it back as a header', async () => {
    const { POST } = await loadProxy();
    const { seen } = stubUpstream({
      'auth/login': {
        body: { mfa_required: true, mfa_token: 'ticket-1', challenge: { methods: [] } },
      },
      'auth/mfa/verify': { body: { user: { id: 'u1' }, access_token: 'access-xyz' } },
    });

    const start = request('auth/login', { method: 'POST', body: JSON.stringify({}) });
    const login = await POST(start.req, start.ctx);
    const loginBody = await login.json();
    expect(loginBody.data.mfa_token).toBeUndefined();
    expect(login.cookies.get('mfa_token')?.value).toBe('ticket-1');

    const verify = request('auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ method: 'sms', code: '483920' }),
      cookie: 'mfa_token=ticket-1',
    });
    const verified = await POST(verify.req, verify.ctx);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).endsWith('auth/mfa/verify')
    );
    expect((call?.[1] as RequestInit).headers).toMatchObject({ 'x-mfa-token': 'ticket-1' });
    expect(seen).toContain('auth/mfa/verify');

    // The completed sign-in supersedes the ticket.
    expect(verified.cookies.get('mfa_token')?.value).toBe('');
  });

  it('attaches the session from the cookie so the browser never sends a token', async () => {
    const { GET } = await loadProxy();
    stubUpstream({ 'users/me': { body: { id: 'u1' } } });

    const { req, ctx } = request('users/me', { cookie: 'access_token=access-abc' });
    await GET(req, ctx);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((call[1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer access-abc',
    });
  });

  it('refreshes once on a 401 and retries the original call', async () => {
    const { GET } = await loadProxy();
    const { seen } = stubUpstream({
      'users/me': [{ status: 401 }, { body: { id: 'u1' } }],
      'auth/token/refresh': { body: { access_token: 'access-new', refresh_token: 'refresh-new' } },
    });

    const { req, ctx } = request('users/me', {
      cookie: 'access_token=access-old; refresh_token=refresh-old',
    });
    const response = await GET(req, ctx);

    expect(response.status).toBe(200);
    expect(seen).toEqual(['users/me', 'auth/token/refresh', 'users/me']);
    expect(response.cookies.get('access_token')?.value).toBe('access-new');
    expect(response.cookies.get('refresh_token')?.value).toBe('refresh-new');
  });

  it('gives up rather than looping when the refresh itself fails', async () => {
    const { GET } = await loadProxy();
    const { seen } = stubUpstream({
      'users/me': { status: 401 },
      'auth/token/refresh': { status: 401 },
    });

    const { req, ctx } = request('users/me', {
      cookie: 'access_token=access-old; refresh_token=refresh-old',
    });
    const response = await GET(req, ctx);

    expect(response.status).toBe(401);
    expect(seen.filter((path) => path === 'auth/token/refresh')).toHaveLength(1);
    expect(seen).toHaveLength(2);
    // The dead session is cleared so the client goes to sign in.
    expect(response.cookies.get('access_token')?.value).toBe('');
    expect(response.cookies.get('refresh_token')?.value).toBe('');
  });

  it('never tries to refresh its way into the sign-in endpoints', async () => {
    const { POST } = await loadProxy();
    const { seen } = stubUpstream({ 'auth/login': { status: 401 } });

    const { req, ctx } = request('auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
      cookie: 'refresh_token=refresh-old',
    });
    const response = await POST(req, ctx);

    expect(response.status).toBe(401);
    expect(seen).toEqual(['auth/login']);
  });

  it('takes the refresh token from the cookie on logout and clears the session', async () => {
    const { POST } = await loadProxy();
    stubUpstream({ 'auth/logout': { body: null } });

    const { req, ctx } = request('auth/logout', {
      method: 'POST',
      cookie: 'access_token=access-abc; refresh_token=refresh-abc',
    });
    const response = await POST(req, ctx);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
      refresh_token: 'refresh-abc',
    });
    expect(response.cookies.get('access_token')?.value).toBe('');
    expect(response.cookies.get('refresh_token')?.value).toBe('');
    expect(response.cookies.get('mfa_token')?.value).toBe('');
  });

  it('always answers with the standard envelope', async () => {
    const { GET } = await loadProxy();
    stubUpstream({ 'users/me': { status: 500, body: null } });

    const { req, ctx } = request('users/me');
    const payload = await (await GET(req, ctx)).json();

    expect(payload).toHaveProperty('data');
    expect(payload).toHaveProperty('meta');
    expect(payload).toHaveProperty('errors');
  });
});
