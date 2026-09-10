'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Alert, SubmitButton } from '@/components/auth/feedback';
import { PasswordChecklist, PasswordField } from '@/components/auth/fields';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { destinationFor } from '@/lib/auth/routes';
import { validatePassword } from '@/lib/auth/validation';

function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    current_password?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (pending) return;
    const next = {
      current_password: current ? undefined : 'Enter your current password.',
      password: validatePassword(password) ?? undefined,
      confirm: password && confirm !== password ? 'Both passwords must match.' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setFormError(null);
    setPending(true);
    try {
      await authApi.changePassword(current, password);
      setDone(true);
      setCurrent('');
      setPassword('');
      setConfirm('');
    } catch (caught) {
      const error =
        caught instanceof AuthError
          ? caught
          : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.');
      setFormError(error);
      setErrors((existing) => ({ ...existing, ...error.fieldErrors }));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <AuthHeading
          title="Your password has been changed"
          description="Use your new password the next time you sign in."
        />
        <button
          type="button"
          onClick={() => router.replace(destinationFor(user))}
          className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <AuthHeading
        title="Change your password"
        description="Confirm your current password, then choose a new one."
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
        <PasswordField
          id="current-password"
          label="Current password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          error={errors.current_password}
          autoComplete="current-password"
          disabled={pending}
          required
        />

        <div className="space-y-3">
          <PasswordField
            id="new-password"
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
          id="new-password-confirm"
          label="Confirm new password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={errors.confirm}
          autoComplete="new-password"
          disabled={pending}
          required
        />

        <SubmitButton pending={pending} pendingLabel="Saving…">
          Change password
        </SubmitButton>
      </form>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <AuthGuard allowUnverified>
      <ChangePasswordScreen />
    </AuthGuard>
  );
}
