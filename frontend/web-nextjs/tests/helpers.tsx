import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '@/hooks/use-auth';
import type { User } from '@/lib/auth/types';

export { router, setSearchParams, setPathname } from './navigation';

type Reply = { status?: number; data?: unknown; meta?: unknown; errors?: unknown[] };

/**
 * Stubs the network at the fetch boundary so the real API client, envelope
 * handling and error normalisation are all exercised by every test.
 */
export function mockApi(routes: Record<string, Reply | (() => Reply)>) {
  const calls: { key: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const key = `${init?.method ?? 'GET'} ${url}`;
    let body: unknown = undefined;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ key, body });

    const entry = routes[key];
    const reply: Reply = typeof entry === 'function' ? entry() : (entry ?? { status: 404 });

    return new Response(
      JSON.stringify({
        data: reply.data ?? null,
        meta: reply.meta ?? {},
        errors: reply.errors ?? [],
      }),
      { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** A signed-out session: /users/me answers 401 like a real unauthenticated call. */
export const noSession = {
  'GET /api/v1/users/me': { status: 401, errors: [{ error_code: 'SESSION_EXPIRED' }] },
};

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    full_name: 'Amina Otieno',
    phone_number: '+254 ••• ••• 482',
    email: null,
    role: 'consumer',
    status: 'ACTIVE',
    kyc_status: null,
    mfa_enabled: false,
    location: 'Nairobi',
    ...overrides,
  };
}

export function renderWithAuth(ui: React.ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}
