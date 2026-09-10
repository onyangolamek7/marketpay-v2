'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Alert, SubmitButton } from '@/components/auth/feedback';
import { PhoneField } from '@/components/auth/fields';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { savePendingReset } from '@/lib/auth/pending-flow';
import { DEFAULT_COUNTRY, findCountry, toE164, validatePhone } from '@/lib/auth/validation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY.iso);
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending) return;
    const country = findCountry(countryIso);
    const invalid = validatePhone(country, phone);
    if (invalid) {
      setFieldError(invalid);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);
    const phoneNumber = toE164(country, phone)!;

    try {
      const challenge = await authApi.forgotPassword(phoneNumber);
      savePendingReset({
        phoneNumber,
        destinationMasked: challenge.destination_masked,
        expiresAt: challenge.expires_at,
        resendAfter: challenge.resend_after,
      });
      router.push('/reset-password');
    } catch (caught) {
      setFormError(
        caught instanceof AuthError
          ? caught
          : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.')
      );
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <AuthHeading
        title="Reset your password"
        description="Enter the phone number on your account. If it matches an account, we will send a 6-digit code."
      />

      {formError && (
        <Alert tone={formError.code === 'RATE_LIMITED' ? 'warning' : 'error'}>
          <p>
            {formError.code === 'RATE_LIMITED'
              ? 'You have asked for a reset code several times. For security, please wait an hour before trying again.'
              : formError.message}
          </p>
        </Alert>
      )}

      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <PhoneField
          id="forgot-phone"
          countryIso={countryIso}
          onCountryChange={setCountryIso}
          value={phone}
          onValueChange={setPhone}
          error={fieldError}
          disabled={pending}
          autoComplete="tel"
          autoFocus
        />

        <SubmitButton pending={pending} pendingLabel="Sending code…">
          Send code
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-action underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
