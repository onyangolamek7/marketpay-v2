import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldCheck, Sprout, TrendingUp, Truck } from 'lucide-react';
import { MarketPayMark } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'MarketPay',
  description:
    'One MarketPay account for payments, marketplace trade and delivery across Kenya, Nigeria and Ethiopia.',
};

const CAPABILITIES = [
  {
    Icon: ShieldCheck,
    title: 'Payments you can trace',
    detail: 'Wallet, escrow and settlement, with every transaction accounted for.',
  },
  {
    Icon: Sprout,
    title: 'A marketplace built for food',
    detail: 'Buy as a household, sell as a retailer, or supply in bulk as a wholesaler.',
  },
  {
    Icon: TrendingUp,
    title: 'Prices you can plan around',
    detail: 'AI price intelligence across the markets you actually buy and sell in.',
  },
  {
    Icon: Truck,
    title: 'Delivery to the last mile',
    detail: 'Orders tracked from the seller to the door, with riders on the route.',
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <MarketPayMark className="text-foreground" />
        <Link
          href="/login"
          className="rounded text-sm font-medium text-action underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-8">
        <section className="py-10 sm:py-16">
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            One account for payments, trade and delivery across Africa.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
            MarketPay brings your wallet, your marketplace and your deliveries together — for
            households, retailers, wholesalers and riders in Kenya, Nigeria and Ethiopia.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-7 text-base font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/40"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-7 text-base font-semibold text-foreground transition-colors hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/25"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-4 text-sm text-text-muted">
            You will need a phone number you can receive an SMS on. It takes about two minutes.
          </p>
        </section>

        <section aria-labelledby="capabilities" className="border-t border-border py-10 sm:py-14">
          <h2 id="capabilities" className="text-xl font-semibold text-foreground">
            What you can do with MarketPay
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {CAPABILITIES.map(({ Icon, title, detail }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-food" aria-hidden="true" />
                <div>
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <p className="mt-1 text-text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="access" className="border-t border-border py-10">
          <h2 id="access" className="text-xl font-semibold text-foreground">
            Getting in touch and getting help
          </h2>
          <div className="mt-4 space-y-3 text-text-muted">
            <p>
              These pages work with a keyboard alone and with a screen reader, and are built to stay
              readable at larger text sizes and on a small phone.
            </p>
            <p>
              No smartphone or data? MarketPay also works over USSD on a basic handset. Ask your
              local MarketPay agent for the code for your country.
            </p>
            <p>
              If something here is hard to use, tell us — accessibility problems are treated as
              faults, not requests.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-5xl px-5 py-6 text-sm text-text-muted sm:px-8">
          © {new Date().getFullYear()} MarketPay. Serving Kenya, Nigeria and Ethiopia.
        </p>
      </footer>
    </div>
  );
}
