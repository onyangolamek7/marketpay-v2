'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Lock, ShieldAlert } from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useAuth } from '@/hooks/use-auth';
import { destinationFor } from '@/lib/auth/routes';

const STATUS_COPY = {
  ACCOUNT_SUSPENDED: {
    Icon: ShieldAlert,
    tone: 'text-danger',
    title: 'Your account is on hold',
    body: 'MarketPay has paused this account. Our support team can tell you what is needed to lift it.',
  },
  ACCOUNT_LOCKED: {
    Icon: Lock,
    tone: 'text-warning',
    title: 'Your account is locked',
    body: 'Too many failed sign-in attempts locked this account for 15 minutes. Resetting your password unlocks it straight away.',
  },
  PENDING: {
    Icon: Clock,
    tone: 'text-action',
    title: 'Your account is being verified',
    body: 'We are still checking your details. You will get a message as soon as this is done.',
  },
} as const;

function AccountStatusScreen() {
  const router = useRouter();
  const { state, user, logout } = useAuth();

  const key =
    state === 'ACCOUNT_SUSPENDED' || state === 'ACCOUNT_LOCKED' ? state : ('PENDING' as const);
  const { Icon, tone, title, body } = STATUS_COPY[key];

  return (
    <div className="space-y-6">
      <Icon className={`size-10 ${tone}`} aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="leading-relaxed text-text-muted">{body}</p>
      </div>

      <div className="space-y-3">
        {key === 'ACCOUNT_LOCKED' && (
          <Link
            href="/forgot-password"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white"
          >
            Reset my password
          </Link>
        )}
        {state === 'AUTHENTICATED' && user && (
          <button
            type="button"
            onClick={() => router.replace(destinationFor(user))}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white"
          >
            Continue to MarketPay
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.replace('/login');
          }}
          className="h-12 w-full rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-surface-deep"
        >
          Sign out
        </button>
      </div>

      <p className="text-sm text-text-muted">
        Need help? Contact MarketPay support and quote your registered phone number.
      </p>
    </div>
  );
}

export default function AccountStatusPage() {
  return (
    <AuthGuard allowUnverified>
      <AccountStatusScreen />
    </AuthGuard>
  );
}
