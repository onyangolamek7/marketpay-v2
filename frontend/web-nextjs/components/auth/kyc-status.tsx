'use client';

import { CheckCircle2, Clock, FileWarning, XCircle } from 'lucide-react';
import type { KycStatus } from '@/lib/auth/types';

const PRESENTATION: Record<
  KycStatus,
  { Icon: typeof Clock; tone: string; title: string; body: string }
> = {
  PENDING: {
    Icon: FileWarning,
    tone: 'text-warning',
    title: 'Verification not started',
    body: 'Send us your documents to activate the rest of your account.',
  },
  SUBMITTED: {
    Icon: Clock,
    tone: 'text-action',
    title: 'Verification submitted',
    body: 'We have your documents and are checking them. This usually takes 1 to 2 working days. We will let you know as soon as there is a decision, and the extra features switch on once your account is approved.',
  },
  APPROVED: {
    Icon: CheckCircle2,
    tone: 'text-success',
    title: 'Verification complete',
    body: 'Your account is verified and every feature for your account type is now available.',
  },
  REJECTED: {
    Icon: XCircle,
    tone: 'text-danger',
    title: 'Verification unsuccessful',
    body: 'We could not verify your account with the documents you sent.',
  },
  NEEDS_MORE_INFO: {
    Icon: FileWarning,
    tone: 'text-warning',
    title: 'We need a little more',
    body: 'Almost there — one more thing is needed before we can finish checking your account.',
  },
};

export function KycStatusCard({
  status,
  reason,
  children,
}: {
  status: KycStatus;
  /** Backend-supplied explanation. Shown as given; never internal detail. */
  reason?: string | null;
  children?: React.ReactNode;
}) {
  const { Icon, tone, title, body } = PRESENTATION[status];
  return (
    <section className="space-y-4">
      <Icon className={`size-10 ${tone}`} aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="leading-relaxed text-text-muted">{body}</p>
        {reason && (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
            <span className="font-medium">What to fix: </span>
            {reason}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
