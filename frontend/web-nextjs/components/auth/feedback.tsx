'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tone = 'error' | 'warning' | 'success' | 'info';

const TONES: Record<Tone, { wrapper: string; Icon: typeof Info }> = {
  error: { wrapper: 'border-danger/30 bg-danger-tint text-danger', Icon: ShieldAlert },
  warning: { wrapper: 'border-warning/30 bg-warning-tint text-warning', Icon: AlertTriangle },
  success: { wrapper: 'border-success/30 bg-success-tint text-success', Icon: CheckCircle2 },
  info: { wrapper: 'border-action/25 bg-action-tint text-action', Icon: Info },
};

export function Alert({
  tone = 'error',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { wrapper, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', wrapper, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-2">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-foreground/90">{children}</div>}
        {action}
      </div>
    </div>
  );
}

/**
 * Submit control for every auth form. Disabling while pending is what prevents
 * a second request from the same click or an impatient double tap.
 */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
  ...props
}: React.ComponentProps<'button'> & { pending: boolean; pendingLabel: string }) {
  return (
    <Button
      type="submit"
      size="lg"
      aria-busy={pending}
      disabled={pending || props.disabled}
      className={cn('h-12 w-full rounded-xl text-base font-semibold', className)}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Full-page placeholder shown while the session is being resolved. */
export function AuthLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-text-muted"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
