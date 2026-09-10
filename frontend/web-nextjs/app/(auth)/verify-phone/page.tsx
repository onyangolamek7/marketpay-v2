'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Alert, AuthLoadingState } from '@/components/auth/feedback';
import { OtpChallengeForm } from '@/components/auth/otp-challenge-form';
import { useAuth } from '@/hooks/use-auth';
import { usePendingRegistration } from '@/hooks/use-pending-flow';
import { authApi } from '@/lib/auth/api';
import { clearPendingRegistration } from '@/lib/auth/pending-flow';
import { destinationFor } from '@/lib/auth/routes';
import type { User } from '@/lib/auth/types';

export default function VerifyPhonePage() {
  const router = useRouter();
  const { adoptSession } = useAuth();
  const pending = usePendingRegistration();

  useEffect(() => {
    if (pending === null) router.replace('/register');
  }, [pending, router]);

  if (pending === undefined) return <AuthLoadingState />;
  if (pending === null) return <AuthLoadingState label="Taking you back to sign up…" />;

  return (
    <div className="space-y-7">
      <AuthHeading
        title="Verify your phone number"
        description="This keeps your MarketPay account and wallet in your hands only."
      />

      <OtpChallengeForm
        channel="sms"
        destinationMasked={pending.destinationMasked}
        expiresAt={pending.expiresAt}
        resendAfter={pending.resendAfter}
        submitLabel="Verify and continue"
        pendingLabel="Verifying…"
        onVerify={async (code) => {
          const result = await authApi.verifyOtp(pending.phoneNumber, code, 'registration');
          clearPendingRegistration();
          const user = (result as { user?: User }).user ?? null;
          if (user) adoptSession(user);
          router.replace(destinationFor(user));
        }}
        onResend={async () => {
          const challenge = await authApi.sendOtp(pending.phoneNumber, 'registration');
          return { expiresAt: challenge.expires_at, resendAfter: challenge.resend_after };
        }}
        lockedFallback={
          <Alert tone="warning" title="Too many attempts">
            <p>
              For your security we have paused verification for 15 minutes. You can try again after
              that, or{' '}
              <Link href="/register" className="font-medium text-action hover:underline">
                start again
              </Link>
              .
            </p>
          </Alert>
        }
      />

      <p className="text-sm text-text-muted">
        Wrong number?{' '}
        <Link href="/register" className="font-medium text-action underline-offset-4 hover:underline">
          Go back and change it
        </Link>
        .
      </p>
    </div>
  );
}
