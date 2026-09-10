import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/components/auth/login-form';
import { makeUser, mockApi, noSession, renderWithAuth, router, setSearchParams } from './helpers';

const LOGIN = 'POST /api/v1/auth/login';

async function fillCredentials(password = 'Mombasa2024!') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Phone number'), '712345678');
  await user.type(screen.getByLabelText('Password'), password);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  setSearchParams('');
});

describe('login', () => {
  it('signs a consumer in and sends them to their dashboard', async () => {
    mockApi({ ...noSession, [LOGIN]: { data: { mfa_required: false, user: makeUser() } } });
    renderWithAuth(<LoginForm />);

    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard/consumer'));
  });

  it('submits the number in E.164 with the country selection applied', async () => {
    const { calls } = mockApi({
      ...noSession,
      [LOGIN]: { data: { mfa_required: false, user: makeUser() } },
    });
    renderWithAuth(<LoginForm />);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Country'), 'NG');
    await user.type(screen.getByLabelText('Phone number'), '8021234567');
    await user.type(screen.getByLabelText('Password'), 'Mombasa2024!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      const call = calls.find((entry) => entry.key === LOGIN);
      expect(call?.body).toMatchObject({ phone_number: '+2348021234567' });
    });
  });

  it('shows a generic message for wrong credentials and reveals nothing else', async () => {
    mockApi({
      ...noSession,
      [LOGIN]: { status: 401, errors: [{ error_code: 'INVALID_CREDENTIALS' }] },
    });
    renderWithAuth(<LoginForm />);

    const user = await fillCredentials('Wrongpass1!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not correct/i);
    // The copy must not disclose whether the number belongs to an account.
    expect(alert.textContent).not.toMatch(/does not exist|not registered|no such user|unknown/i);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('explains a locked account and offers a password reset', async () => {
    mockApi({
      ...noSession,
      [LOGIN]: { status: 423, errors: [{ error_code: 'ACCOUNT_LOCKED' }] },
    });
    renderWithAuth(<LoginForm />);

    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/temporarily locked/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reset your password/i })).toBeInTheDocument();
  });

  it('asks the user to wait when the endpoint is rate limited', async () => {
    mockApi({ ...noSession, [LOGIN]: { status: 429, errors: [{ error_code: 'RATE_LIMITED' }] } });
    renderWithAuth(<LoginForm />);

    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/wait a moment/i)).toBeInTheDocument();
  });

  it('offers a retry when the network is unreachable', async () => {
    mockApi(noSession);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (input.toString().endsWith('/users/me')) {
          return new Response(JSON.stringify({ data: null, errors: [] }), { status: 401 });
        }
        throw new TypeError('Failed to fetch');
      })
    );
    renderWithAuth(<LoginForm />);

    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/Unable to connect to MarketPay/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('sends an account with MFA to the challenge instead of a dashboard', async () => {
    mockApi({
      ...noSession,
      [LOGIN]: {
        data: {
          mfa_required: true,
          challenge: {
            methods: [{ type: 'sms', destination_masked: '+254 ••• ••• 678' }],
            expires_at: new Date(Date.now() + 180_000).toISOString(),
            attempts_remaining: 5,
          },
        },
      },
    });
    renderWithAuth(<LoginForm />);

    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/mfa'));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows a pending label and blocks a second submission while in flight', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi({
      ...noSession,
      [LOGIN]: { data: { mfa_required: false, user: makeUser() } },
    });
    const passthrough = globalThis.fetch as ReturnType<typeof vi.fn>;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') await gate;
        return passthrough(input, init);
      })
    );

    renderWithAuth(<LoginForm />);
    const user = await fillCredentials();
    const submit = screen.getByRole('button', { name: 'Sign in' });

    await user.click(submit);
    const pending = await screen.findByRole('button', { name: /Signing in/ });
    expect(pending).toBeDisabled();
    await user.click(pending);

    release?.();
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  });

  it('validates before reaching the network', async () => {
    const { calls } = mockApi(noSession);
    renderWithAuth(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Phone number'), '71');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/valid Kenya number/i)).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.key === LOGIN)).toBe(false);
  });

  it('honours a same-site redirect and ignores an external one', async () => {
    mockApi({ ...noSession, [LOGIN]: { data: { mfa_required: false, user: makeUser() } } });

    setSearchParams('redirect=https://evil.example.com');
    const first = renderWithAuth(<LoginForm />);
    let user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard/consumer'));
    first.unmount();
    vi.clearAllMocks();

    setSearchParams('redirect=/wallet');
    renderWithAuth(<LoginForm />);
    user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/wallet'));
  });

  it('never renders a token, and keeps the password masked until asked', async () => {
    mockApi({
      ...noSession,
      [LOGIN]: {
        data: {
          mfa_required: false,
          user: makeUser(),
          // A backend that leaks tokens into the body must not leak them onto the page.
          access_token: 'header.payload.signature',
        },
      },
    });
    const { container } = renderWithAuth(<LoginForm />);

    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');

    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('text');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(container.innerHTML).not.toContain('header.payload.signature');
  });
});
