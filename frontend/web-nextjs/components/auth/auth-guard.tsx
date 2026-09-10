'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthLoadingState } from '@/components/auth/feedback';
import { useAuth } from '@/hooks/use-auth';
import { destinationFor } from '@/lib/auth/routes';
import { ROLE_LABELS, type Role } from '@/lib/auth/types';

interface AuthGuardProps {
  children: React.ReactNode;
  /** When set, only these roles may see the children. */
  roles?: Role[];
  /**
   * Screens that exist *for* an unfinished account (KYC, account status) opt out
   * of the status redirect, otherwise they would bounce to themselves.
   */
  allowUnverified?: boolean;
}

/**
 * Client-side gate. It stops protected content from rendering before the
 * session is known — it is not the authorization boundary. The API Gateway
 * remains the only thing that actually grants access to data.
 */
export function AuthGuard({ children, roles, allowUnverified = false }: AuthGuardProps) {
  const { state, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const unauthenticated = state === 'UNAUTHENTICATED' || state === 'SESSION_EXPIRED';
  const misrouted =
    !allowUnverified &&
    user !== null &&
    ['KYC_REQUIRED', 'KYC_PENDING', 'ACCOUNT_SUSPENDED', 'ACCOUNT_LOCKED'].includes(state);

  useEffect(() => {
    if (unauthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (misrouted) {
      router.replace(destinationFor(user));
    }
  }, [unauthenticated, misrouted, router, pathname, user]);

  if (state === 'INITIALIZING') return <AuthLoadingState label="Checking your session…" />;
  if (unauthenticated) return <AuthLoadingState label="Taking you to sign in…" />;
  if (misrouted) return <AuthLoadingState label="One moment…" />;

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">This area is not available to you</h1>
        <p className="text-text-muted">
          Your account is set up as {ROLE_LABELS[user.role]}. If you think this is wrong, contact
          MarketPay support.
        </p>
        <Link
          href={destinationFor(user)}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white"
        >
          Go to my dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
