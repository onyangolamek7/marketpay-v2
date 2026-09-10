import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import ResetPasswordPage from '@/app/(auth)/reset-password/page';
import ChangePasswordPage from '@/app/(auth)/change-password/page';
import { savePendingReset } from '@/lib/auth/pending-flow';
import { makeUser, mockApi, noSession, renderWithAuth, router } from './helpers';

const FORGOT = 'POST /api/v1/auth/password/forgot';
const RESET = 'POST /api/v1/auth/password/reset';
const CHANGE = 'POST /api/v1/auth/password/change';
const ME = 'GET /api/v1/users/me';

const challenge = {
  data: {
    destination_masked: '+254 ••• ••• 678',
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    resend_after: 30,
  },
};

function seedReset() {
  savePendingReset({
    phoneNumber: '+254712345678',
    destinationMasked: '+254 ••• ••• 678',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    resendAfter: 30,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('forgot password', () => {
  it('promises nothing about whether the number exists', () => {
    mockApi({});
    render(<ForgotPasswordPage />);
    expect(screen.getByText(/If it matches an account/i)).toBeInTheDocument();
  });

  it('sends the number in E.164 and moves to the reset screen', async () => {
    const { calls } = mockApi({ [FORGOT]: challenge });
    render(<ForgotPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Phone number'), '712345678');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/reset-password'));
    expect(calls.find((entry) => entry.key === FORGOT)?.body).toEqual({
      phone_number: '+254712345678',
    });
  });

  it('explains the hourly limit without naming the account', async () => {
    mockApi({ [FORGOT]: { status: 429, errors: [{ error_code: 'RATE_LIMITED' }] } });
    render(<ForgotPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Phone number'), '712345678');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    const alert = await screen.findByRole('status');
    expect(alert).toHaveTextContent(/wait an hour/i);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('validates the number before calling out', async () => {
    const { calls } = mockApi({});
    render(<ForgotPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Phone number'), '712');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText(/valid Kenya number/)).toBeInTheDocument();
    expect(calls.some((entry) => entry.key === FORGOT)).toBe(false);
  });
});

describe('reset password', () => {
  it('returns to the start when no recovery is in progress', async () => {
    mockApi({});
    render(<ResetPasswordPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/forgot-password'));
  });

  it('requires the code and a compliant, matching password', async () => {
    seedReset();
    const { calls } = mockApi({});
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), 'weak');
    await user.type(screen.getByLabelText('Confirm new password'), 'weaker');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Enter the 6-digit code.')).toBeInTheDocument();
    expect(screen.getByText(/does not meet all the requirements/)).toBeInTheDocument();
    expect(screen.getByText('Both passwords must match.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.key === RESET)).toBe(false);
  });

  it('reports an invalid code and lets the user try again', async () => {
    seedReset();
    mockApi({ [RESET]: { status: 400, errors: [{ error_code: 'INVALID_OTP' }] } });
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Verification code'), '111111');
    await user.type(screen.getByLabelText('New password'), 'Mombasa2024!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Mombasa2024!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not correct/);
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
  });

  it('confirms success and hands over to sign in rather than logging in', async () => {
    seedReset();
    const { calls } = mockApi({ [RESET]: { data: null } });
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Verification code'), '483920');
    await user.type(screen.getByLabelText('New password'), 'Mombasa2024!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Mombasa2024!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Your password has been reset')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(calls.find((entry) => entry.key === RESET)?.body).toMatchObject({
      phone_number: '+254712345678',
      code: '483920',
    });
    expect(router.replace).not.toHaveBeenCalledWith('/dashboard/consumer');
  });
});

describe('change password', () => {
  it('requires the current password and rejects a mismatch server-side', async () => {
    mockApi({
      [ME]: { data: makeUser() },
      [CHANGE]: {
        status: 400,
        errors: [{ error_code: 'INVALID_CREDENTIALS', field: 'current_password' }],
      },
    });
    renderWithAuth(<ChangePasswordPage />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Current password'), 'Oldpass2024!');
    await user.type(screen.getByLabelText('New password'), 'Mombasa2024!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Mombasa2024!');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not correct/);
    expect(screen.queryByText('Your password has been changed')).not.toBeInTheDocument();
  });

  it('confirms a successful change', async () => {
    mockApi({ [ME]: { data: makeUser() }, [CHANGE]: { data: null } });
    renderWithAuth(<ChangePasswordPage />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Current password'), 'Oldpass2024!');
    await user.type(screen.getByLabelText('New password'), 'Mombasa2024!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Mombasa2024!');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Your password has been changed')).toBeInTheDocument();
  });

  it('sends an unauthenticated visitor to sign in', async () => {
    mockApi(noSession);
    renderWithAuth(<ChangePasswordPage />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('/login'))
    );
  });
});
