'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Alert, AuthLoadingState, SubmitButton } from '@/components/auth/feedback';
import { PasswordChecklist, PasswordField } from '@/components/auth/fields';
import { OtpInput } from '@/components/auth/otp-input';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { clearPendingReset } from '@/lib/auth/pending-flow';
import { usePendingReset } from '@/hooks/use-pending-flow';
import { formatDuration, useCountdown } from '@/hooks/use-countdown';
import { validateOtp, validatePassword } from '@/lib/auth/validation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const flow = usePendingReset();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const expirySeconds = useCountdown(flow?.expiresAt ? new Date(flow.expiresAt).getTime() : null);

  useEffect(() => {
    if (flow === null) router.replace('/forgot-password');
  }, [flow, router]);

  async function submit() {
    if (pending || !flow) return;
    const next = {
      code: validateOtp(code) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: password && confirm !== password ? 'Both passwords must match.' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setFormError(null);
    setPending(true);
    try {
      await authApi.resetPassword(flow.phoneNumber, code, password);
      clearPendingReset();
      setDone(true);
    } catch (caught) {
      setFormError(
        caught instanceof AuthError
          ? caught
          : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.')
      );
      setCode('');
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <AuthHeading
          title="Your password has been reset"
          description="For your safety we signed you out everywhere else. Use your new password to sign in."
        />
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  if (flow === undefined) return <AuthLoadingState />;
  if (flow === null) return <AuthLoadingState label="Taking you back…" />;

  return (
    <div className="space-y-7">
      <AuthHeading
        title="Create a new password"
        description={
          <>
            Enter the code we sent to{' '}
            <span className="font-medium tracking-wide text-foreground">
              {flow.destinationMasked}
            </span>{' '}
            and choose a new password.
          </>
        }
      />

      {formError && <Alert tone="error">{formError.message}</Alert>}

      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <OtpInput
          id="reset-code"
          value={code}
          onChange={setCode}
          error={errors.code}
          disabled={pending}
          autoFocus
        />

        <p aria-live="polite" className="text-sm text-text-muted">
          {expirySeconds > 0 ? (
            <>
              Code expires in{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatDuration(expirySeconds)}
              </span>
            </>
          ) : (
            <span className="font-medium text-warning">
              This code has expired.{' '}
              <Link href="/forgot-password" className="text-action hover:underline">
                Request a new one
              </Link>
              .
            </span>
          )}
        </p>

        <div className="space-y-3">
          <PasswordField
            id="reset-password"
            label="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            autoComplete="new-password"
            disabled={pending}
            required
          />
          <PasswordChecklist value={password} />
        </div>

        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={errors.confirm}
          autoComplete="new-password"
          disabled={pending}
          required
        />

        <SubmitButton pending={pending} pendingLabel="Resetting password…">
          Reset password
        </SubmitButton>
      </form>
    </div>
  );
}
