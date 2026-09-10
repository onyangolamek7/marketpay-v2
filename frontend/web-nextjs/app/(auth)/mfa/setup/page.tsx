'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Alert, AuthLoadingState, SubmitButton } from '@/components/auth/feedback';
import { OtpInput } from '@/components/auth/otp-input';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { destinationFor } from '@/lib/auth/routes';
import type { TotpSetup } from '@/lib/auth/types';
import { validateOtp } from '@/lib/auth/validation';

function TotpSetupScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  // Bumping `attempt` is what re-runs the fetch, so the effect never has to
  // call a function that writes state before its first await.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authApi.setupTotp().then(
      (next) => {
        if (cancelled) return;
        setSetup(next);
        setLoadError(null);
      },
      (caught: unknown) => {
        if (cancelled) return;
        setLoadError(
          caught instanceof AuthError ? caught.message : 'We could not start setup. Try again.'
        );
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function confirm() {
    const invalid = validateOtp(code);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await authApi.confirmTotp(code);
      await refreshUser();
      setDone(true);
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : 'That code was not accepted.');
      setCode('');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <AuthHeading
          title="Authenticator app added"
          description="From now on we will ask for a code from your app when you sign in."
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
        title="Set up your authenticator app"
        description="Add MarketPay to an app like Google Authenticator, then enter the code it shows."
      />

      {loadError && (
        <Alert tone="error">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="font-medium text-action underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </Alert>
      )}

      {!setup && !loadError && <AuthLoadingState label="Preparing setup…" />}

      {setup && (
        <>
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            {/*
              ponytail: the QR is drawn from the backend's provisioning URI. Rendering
              it as an image needs a QR encoder — add a local one when a dependency is
              approved. Never send this URI to a third-party QR service: it carries the
              shared secret. Manual entry below covers every user meanwhile.
            */}
            <div
              className="flex aspect-square w-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center text-sm text-text-muted"
              role="img"
              aria-label="QR code placeholder. Use the setup key below to add MarketPay manually."
            >
              <QrCode className="size-8" aria-hidden="true" />
              <span className="px-3">Use the setup key below</span>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">Setup key</p>
              <p className="mt-1 select-all break-all font-mono text-base tracking-wide text-foreground">
                {setup.manual_key}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Enter this key in your authenticator app, choosing &ldquo;time based&rdquo;.
              </p>
            </div>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <OtpInput
              id="totp-setup-code"
              label="Code from your app"
              value={code}
              onChange={setCode}
              onComplete={() => void confirm()}
              disabled={pending}
            />
            <SubmitButton pending={pending} pendingLabel="Confirming…">
              Confirm and turn on
            </SubmitButton>
          </form>
        </>
      )}
    </div>
  );
}

export default function TotpSetupPage() {
  return (
    <AuthGuard allowUnverified>
      <TotpSetupScreen />
    </AuthGuard>
  );
}
