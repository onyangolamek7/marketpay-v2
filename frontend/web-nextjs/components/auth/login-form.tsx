'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PasswordField, PhoneField } from '@/components/auth/fields';
import { Alert, SubmitButton } from '@/components/auth/feedback';
import { AuthHeading } from '@/components/auth/auth-shell';
import { useAuth } from '@/hooks/use-auth';
import { AuthError } from '@/lib/auth/errors';
import { destinationFor } from '@/lib/auth/routes';
import { DEFAULT_COUNTRY, findCountry, toE164, validatePhone } from '@/lib/auth/validation';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  // Only same-site paths are honoured, so ?redirect= cannot bounce a signed-in
  // user off to another origin.
  const requested = useSearchParams().get('redirect');
  const redirectTo = requested && /^\/(?!\/)/.test(requested) ? requested : undefined;

  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY.iso);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; password?: string }>({});

  async function submit() {
    if (pending) return;

    const country = findCountry(countryIso);
    const phoneError = validatePhone(country, phone);
    // Trailing whitespace from a paste or a phone keyboard is never intended.
    const cleanPassword = password.trim();
    const passwordError = cleanPassword ? undefined : 'Enter your password.';

    if (phoneError || passwordError) {
      setFieldErrors({ phone: phoneError ?? undefined, password: passwordError });
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const result = await login(toE164(country, phone)!, cleanPassword);
      if (result.status === 'mfa_required') {
        router.push('/mfa');
        return;
      }
      router.replace(redirectTo || destinationFor(result.user));
    } catch (caught) {
      const error =
        caught instanceof AuthError
          ? caught
          : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.');
      setFormError(error);
      setFieldErrors(error.fieldErrors);
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <AuthHeading
        title="Welcome back"
        description="Sign in with the phone number on your MarketPay account."
      />

      {formError && (
        <Alert tone={formError.code === 'ACCOUNT_LOCKED' ? 'warning' : 'error'}>
          <p>{formError.message}</p>
          {formError.code === 'ACCOUNT_LOCKED' && (
            <p className="mt-1">
              <Link href="/forgot-password" className="font-medium text-action hover:underline">
                Reset your password
              </Link>{' '}
              to regain access sooner.
            </p>
          )}
          {formError.isRetryable && (
            <button
              type="button"
              onClick={() => void submit()}
              className="font-medium text-action underline-offset-4 hover:underline"
            >
              Try again
            </button>
          )}
        </Alert>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
        className="space-y-5"
      >
        <PhoneField
          id="login-phone"
          countryIso={countryIso}
          onCountryChange={setCountryIso}
          value={phone}
          onValueChange={setPhone}
          error={fieldErrors.phone}
          disabled={pending}
          autoComplete="tel"
          autoFocus
        />

        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          disabled={pending}
          autoComplete="current-password"
          required
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="rounded text-sm font-medium text-action underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-text-muted">
        New to MarketPay?{' '}
        <Link href="/register" className="font-medium text-action underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
