import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationForm } from '@/components/auth/registration-form';
import { mockApi, router } from './helpers';
import { readPendingRegistration } from '@/lib/auth/pending-flow';

const REGISTER = 'POST /api/v1/auth/register';
const SEND_OTP = 'POST /api/v1/auth/otp/send';

const otpChallenge = {
  data: {
    destination_masked: '+254 ••• ••• 678',
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    resend_after: 30,
  },
};

async function chooseRole(role: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: new RegExp(`^${role}`, 'i') }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return user;
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>, password = 'Mombasa2024!') {
  await user.type(screen.getByLabelText('Full name'), 'Amina Otieno');
  await user.type(screen.getByLabelText('Phone number'), '712345678');
  await user.type(screen.getByLabelText('Town or county'), 'Nairobi');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), password);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registration', () => {
  it('offers only the four public roles', () => {
    render(<RegistrationForm />);
    const roles = screen.getAllByRole('radio');
    expect(roles).toHaveLength(4);
    expect(screen.getByRole('radio', { name: /^Consumer/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Rider/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Government/i })).not.toBeInTheDocument();
  });

  it('explains that elevated roles need verification, and how the rest are provisioned', async () => {
    render(<RegistrationForm />);
    const user = userEvent.setup();

    expect(screen.queryByText(/Identity verification needed/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^Retailer/ }));
    expect(screen.getByText(/Identity verification needed/)).toBeInTheDocument();

    expect(screen.getByText(/Government analyst or administrator\?/)).toBeInTheDocument();
    expect(screen.getByText(/created by MarketPay/)).toBeInTheDocument();
  });

  it('ticks each password requirement as it is met', async () => {
    render(<RegistrationForm />);
    const user = await chooseRole('Consumer');

    const list = screen.getByRole('list', { name: 'Password requirements' });
    const requirement = (label: string) =>
      within(list).getByText(label).closest('li') as HTMLElement;

    await user.type(screen.getByLabelText('Password'), 'abc');
    expect(requirement('At least 8 characters')).toHaveTextContent('not met yet');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Mombasa2024!');
    for (const label of [
      'At least 8 characters',
      'One uppercase letter',
      'One number',
      'One symbol',
    ]) {
      expect(requirement(label)).toHaveTextContent('met');
    }
  });

  it('blocks submission on a weak password and on mismatched confirmation', async () => {
    const { calls } = mockApi({});
    render(<RegistrationForm />);
    const user = await chooseRole('Consumer');

    await user.type(screen.getByLabelText('Full name'), 'Amina Otieno');
    await user.type(screen.getByLabelText('Phone number'), '712345678');
    await user.type(screen.getByLabelText('Town or county'), 'Nairobi');
    await user.type(screen.getByLabelText('Password'), 'weakpass');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/does not meet all the requirements/)).toBeInTheDocument();
    expect(screen.getByText('Both passwords must match.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.key === REGISTER)).toBe(false);
  });

  it('treats email as optional for a consumer and required for a retailer', async () => {
    const { unmount } = render(<RegistrationForm />);
    let user = await chooseRole('Consumer');
    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    unmount();

    render(<RegistrationForm />);
    user = await chooseRole('Retailer');
    expect(screen.queryByText('(optional)')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Full name'), 'Amina Otieno');
    await user.type(screen.getByLabelText('Phone number'), '712345678');
    await user.type(screen.getByLabelText('Town or county'), 'Nairobi');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
  });

  it('registers, requests a code and moves to phone verification', async () => {
    const { calls } = mockApi({
      [REGISTER]: { data: { user_id: 'u1', status: 'PENDING_VERIFICATION' } },
      [SEND_OTP]: otpChallenge,
    });
    render(<RegistrationForm />);
    const user = await chooseRole('Consumer');
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/verify-phone'));

    const register = calls.find((entry) => entry.key === REGISTER);
    expect(register?.body).toMatchObject({
      full_name: 'Amina Otieno',
      phone_number: '+254712345678',
      role: 'consumer',
      location: 'Nairobi',
    });

    const pending = readPendingRegistration();
    expect(pending).toMatchObject({ phoneNumber: '+254712345678', role: 'consumer' });
    // Nothing secret is carried between steps.
    expect(JSON.stringify(pending)).not.toContain('Mombasa2024!');
  });

  it('puts a duplicate-number error on the phone field', async () => {
    mockApi({
      [REGISTER]: {
        status: 409,
        errors: [{ error_code: 'PHONE_TAKEN', field: 'phone_number' }],
      },
    });
    render(<RegistrationForm />);
    const user = await chooseRole('Consumer');
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a pending label while the account is being created', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi({
      [REGISTER]: { data: { user_id: 'u1', status: 'PENDING_VERIFICATION' } },
      [SEND_OTP]: otpChallenge,
    });
    const passthrough = globalThis.fetch as ReturnType<typeof vi.fn>;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input.toString().includes('/auth/register')) await gate;
        return passthrough(input, init);
      })
    );

    render(<RegistrationForm />);
    const user = await chooseRole('Consumer');
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const pending = await screen.findByRole('button', { name: /Creating account/ });
    expect(pending).toBeDisabled();
    release?.();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });
});
