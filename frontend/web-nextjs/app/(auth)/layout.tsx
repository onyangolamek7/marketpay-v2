import Link from 'next/link';
import { AuthBrandPanel, MarketPayMark } from '@/components/auth/auth-shell';
import { OfflineBanner } from '@/components/auth/offline-banner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AuthBrandPanel />
        <main id="main" className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <Link
            href="/"
            className="mb-8 w-fit rounded-lg text-foreground lg:hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/25"
          >
            <MarketPayMark />
          </Link>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
