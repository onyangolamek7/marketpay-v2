import Link from 'next/link';
import { cn } from '@/lib/utils';

export function MarketPayMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-lg bg-food font-bold text-white"
      >
        M
      </span>
      <span className="text-lg font-semibold tracking-tight">MarketPay</span>
    </span>
  );
}

/**
 * Trust panel shown alongside every authentication screen on large viewports.
 * Hidden on phones so the form is the first and only thing in view.
 */
export function AuthBrandPanel() {
  const points = [
    ['Payments you can trace', 'Wallet, escrow and settlement in one place.'],
    ['Marketplace built for food', 'Retail, wholesale and last-mile delivery.'],
    ['Prices you can plan around', 'AI price intelligence across your markets.'],
  ];

  return (
    <aside className="hidden bg-primary px-10 py-12 text-white lg:flex lg:w-[42%] lg:flex-col lg:justify-between xl:px-14">
      <Link href="/" className="w-fit rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40">
        <MarketPayMark />
      </Link>

      <div className="max-w-md space-y-8 py-12">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          One account for payments, trade and delivery across Africa.
        </h2>
        <ul className="space-y-5">
          {points.map(([title, detail]) => (
            <li key={title} className="border-l-2 border-food pl-4">
              <p className="font-medium">{title}</p>
              <p className="mt-0.5 text-sm text-white/70">{detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-white/60">
        Serving Kenya, Nigeria and Ethiopia. © {new Date().getFullYear()} MarketPay.
      </p>
    </aside>
  );
}

export function AuthHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      {description && <p className="text-base leading-relaxed text-text-muted">{description}</p>}
      {children}
    </header>
  );
}

export function Stepper({
  steps,
  current,
  label = 'Registration progress',
}: {
  steps: string[];
  current: number;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="space-y-2">
      <p className="text-sm font-medium text-text-muted">
        Step {current + 1} of {steps.length}
        <span className="text-foreground"> · {steps[current]}</span>
      </p>
      <ol className="flex gap-1.5" role="list">
        {steps.map((step, index) => (
          <li key={step} className="flex-1">
            <span className="sr-only">
              {step}
              {index < current ? ' (completed)' : index === current ? ' (current)' : ''}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'block h-1.5 rounded-full transition-colors',
                index <= current ? 'bg-action' : 'bg-surface-deep'
              )}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}
