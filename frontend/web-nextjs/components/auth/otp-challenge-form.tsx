'use client';

import { useCallback, useState } from 'react';
import { Alert, SubmitButton } from '@/components/auth/feedback';
import { OtpInput } from '@/components/auth/otp-input';
import { AuthError } from '@/lib/auth/errors';
import { validateOtp } from '@/lib/auth/validation';
import { formatDuration, useCountdown } from '@/hooks/use-countdown';

export interface OtpChallengeFormProps {
  /** Already masked by the backend; never a full number or address. */
  destinationMasked?: string | null;
  channel: 'sms' | 'email' | 'totp';
  /** ISO timestamp the current code stops working. */
  expiresAt?: string | null;
  /** Seconds before "Send a new code" becomes available. */
  resendAfter?: number;
  onVerify: (code: string) => Promise<void>;
  onResend?: () => Promise<{ expiresAt?: string | null; resendAfter?: number } | void>;
  submitLabel?: string;
  pendingLabel?: string;
  /** Shown when the account is locked out, in place of the form. */
  lockedFallback?: React.ReactNode;
}

const CHANNEL_COPY = {
  sms: 'We sent a 6-digit code by SMS to',
  email: 'We sent a 6-digit code to',
  totp: 'Open your authenticator app and enter the current code for',
} as const;

export function OtpChallengeForm({
  destinationMasked,
  channel,
  expiresAt,
  resendAfter = 0,
  onVerify,
  onResend,
  submitLabel = 'Verify',
  pendingLabel = 'Verifying…',
  lockedFallback,
}: OtpChallengeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<AuthError | string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [attempts, setAttempts] = useState<number | null>(null);

  /**
   * A resend replaces the deadlines the props arrived with. Keeping only the
   * replacement in state means nothing has to be copied out of props on mount.
   */
  const [resent, setResent] = useState<{ expiresAt?: string | null; resendAfter: number } | null>(
    null
  );
  const [resendDeadline, setResendDeadline] = useState<number | null>(() =>
    resendAfter ? Date.now() + resendAfter * 1000 : null
  );

  const activeExpiry = resent ? resent.expiresAt : expiresAt;
  const expiryDeadline = activeExpiry ? new Date(activeExpiry).getTime() : null;

  const expirySeconds = useCountdown(expiryDeadline);
  const resendSeconds = useCountdown(resendDeadline);
  const expired = Boolean(expiryDeadline) && expirySeconds === 0;

  const submit = useCallback(
    async (candidate: string) => {
      const invalid = validateOtp(candidate);
      if (invalid) {
        setError(invalid);
        return;
      }
      setError(null);
      setNotice(null);
      setPending(true);
      try {
        await onVerify(candidate);
      } catch (caught) {
        const authError =
          caught instanceof AuthError ? caught : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.');
        setError(authError);
        setAttempts(authError.attemptsRemaining);
        if (authError.isLockout) setLocked(true);
        setCode('');
      } finally {
        setPending(false);
      }
    },
    [onVerify]
  );

  const resend = useCallback(async () => {
    if (!onResend) return;
    setResending(true);
    setError(null);
    try {
      const next = await onResend();
      setCode('');
      setNotice('We sent a new code. It can take a moment to arrive.');
      setResent({ expiresAt: next?.expiresAt ?? null, resendAfter: next?.resendAfter ?? 30 });
      setResendDeadline(Date.now() + (next?.resendAfter ?? 30) * 1000);
    } catch (caught) {
      setError(caught instanceof AuthError ? caught : 'We could not send a new code. Try again.');
    } finally {
      setResending(false);
    }
  }, [onResend]);

  if (locked && lockedFallback) return <>{lockedFallback}</>;

  const errorMessage = error instanceof AuthError ? error.message : error;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(code);
      }}
      className="space-y-5"
    >
      {destinationMasked && (
        <p className="text-base text-text-muted">
          {CHANNEL_COPY[channel]}{' '}
          <span className="font-medium tracking-wide text-foreground">{destinationMasked}</span>
        </p>
      )}

      {errorMessage && (
        <Alert tone={locked ? 'warning' : 'error'}>
          <p>{errorMessage}</p>
          {attempts !== null && attempts > 0 && !locked && (
            <p className="mt-1 text-text-muted">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'} left before this account is
              locked for 15 minutes.
            </p>
          )}
        </Alert>
      )}

      {notice && !errorMessage && <Alert tone="success">{notice}</Alert>}

      <OtpInput
        id="otp-code"
        value={code}
        onChange={setCode}
        onComplete={(complete) => void submit(complete)}
        error={null}
        disabled={pending || locked}
        autoFocus
      />

      <div
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted"
      >
        {channel === 'totp' ? (
          <span>Codes refresh every 30 seconds.</span>
        ) : expired ? (
          <span className="font-medium text-warning">
            This code has expired. Request a new one.
          </span>
        ) : expiryDeadline ? (
          <span>
            Code expires in{' '}
            <span className="font-medium tabular-nums text-foreground">
              {formatDuration(expirySeconds)}
            </span>
          </span>
        ) : (
          <span />
        )}

        {onResend && (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resendSeconds > 0 || resending}
            className="rounded font-medium text-action underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-text-light disabled:no-underline"
          >
            {resending
              ? 'Sending…'
              : resendSeconds > 0
                ? `Send a new code in ${formatDuration(resendSeconds)}`
                : 'Send a new code'}
          </button>
        )}
      </div>

      <SubmitButton pending={pending} pendingLabel={pendingLabel} disabled={locked}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
