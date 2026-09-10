import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OtpChallengeForm } from '@/components/auth/otp-challenge-form';
import { OtpInput } from '@/components/auth/otp-input';
import { AuthError } from '@/lib/auth/errors';

const inFiveMinutes = () => new Date(Date.now() + 300_000).toISOString();

function Harness(props: Partial<React.ComponentProps<typeof OtpChallengeForm>> = {}) {
  return (
    <OtpChallengeForm
      channel="sms"
      destinationMasked="+254 ••• ••• 678"
      expiresAt={inFiveMinutes()}
      onVerify={props.onVerify ?? (async () => {})}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OTP input', () => {
  it('takes six digits through one control and rejects anything else', async () => {
    function Controlled() {
      const [value, setValue] = useState('');
      return <OtpInput id="code" value={value} onChange={setValue} />;
    }
    render(<Controlled />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Verification code');

    await user.type(field, '12ab34');
    expect(field).toHaveValue('1234');

    await user.type(field, '5678');
    expect(field).toHaveValue('123456');
  });

  it('accepts a pasted code and reports completion once', async () => {
    const onComplete = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('');
      return <OtpInput id="code" value={value} onChange={setValue} onComplete={onComplete} />;
    }
    render(<Controlled />);
    const user = userEvent.setup();

    const field = screen.getByLabelText('Verification code');
    await user.click(field);
    await user.paste('483920');

    expect(field).toHaveValue('483920');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('483920');
  });

  it('supports backspace without hunting for the right box', async () => {
    function Controlled() {
      const [value, setValue] = useState('');
      return <OtpInput id="code" value={value} onChange={setValue} />;
    }
    render(<Controlled />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Verification code');

    await user.type(field, '123456');
    await user.type(field, '{backspace}{backspace}');
    expect(field).toHaveValue('1234');
  });
});

describe('OTP challenge', () => {
  it('shows the masked destination and never a full number', () => {
    render(<Harness />);
    expect(screen.getByText('+254 ••• ••• 678')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\+254\d{9}/);
  });

  it('verifies a correct code as soon as it is complete', async () => {
    const onVerify = vi.fn(async () => {});
    render(<Harness onVerify={onVerify} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Verification code'), '483920');
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith('483920'));
  });

  it('reports an incorrect code and clears the field for another try', async () => {
    const onVerify = vi.fn(async () => {
      throw new AuthError('INVALID_OTP', 'That code is not correct. Check it and try again.', {
        meta: { attempts_remaining: 3 },
      });
    });
    render(<Harness onVerify={onVerify} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Verification code'), '111111');

    expect(await screen.findByRole('alert')).toHaveTextContent(/not correct/);
    expect(screen.getByText(/3 attempts left/)).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
  });

  it('reports an expired code distinctly from a wrong one', async () => {
    const onVerify = vi.fn(async () => {
      throw new AuthError('OTP_EXPIRED', 'That code has expired. Request a new one.');
    });
    render(<Harness onVerify={onVerify} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Verification code'), '111111');
    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/);
  });

  it('replaces the form with the lockout message after too many attempts', async () => {
    const onVerify = vi.fn(async () => {
      throw new AuthError('ACCOUNT_LOCKED', 'locked');
    });
    render(
      <Harness onVerify={onVerify} lockedFallback={<p>Account locked for 15 minutes</p>} />
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Verification code'), '111111');

    expect(await screen.findByText('Account locked for 15 minutes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  });

  it('holds the resend link until the cooldown has passed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onResend = vi.fn(async () => ({ expiresAt: inFiveMinutes(), resendAfter: 30 }));
    render(<Harness resendAfter={30} onResend={onResend} />);

    expect(screen.getByRole('button', { name: /Send a new code in/ })).toBeDisabled();

    await vi.advanceTimersByTimeAsync(31_000);
    const resend = await screen.findByRole('button', { name: 'Send a new code' });
    expect(resend).toBeEnabled();
    vi.useRealTimers();

    await userEvent.setup().click(resend);
    await waitFor(() => expect(onResend).toHaveBeenCalledOnce());
    expect(await screen.findByText(/sent a new code/i)).toBeInTheDocument();
  });

  it('counts the code down and then says it has expired', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness expiresAt={new Date(Date.now() + 65_000).toISOString()} />);

    expect(await screen.findByText(/Code expires in/)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(66_000);
    expect(await screen.findByText(/This code has expired/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('will not send a code shorter than six digits', async () => {
    const onVerify = vi.fn(async () => {});
    render(<Harness onVerify={onVerify} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Verification code'), '123');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(onVerify).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/6-digit code/);
  });

  it('tells an authenticator-app user that codes rotate, and offers no resend', () => {
    render(<Harness channel="totp" expiresAt={null} onResend={undefined} />);
    expect(screen.getByText(/refresh every 30 seconds/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send a new code/ })).not.toBeInTheDocument();
  });
});
