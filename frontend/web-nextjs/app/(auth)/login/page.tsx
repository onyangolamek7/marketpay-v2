import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { AuthLoadingState } from '@/components/auth/feedback';

export const metadata: Metadata = {
  title: 'Sign in · MarketPay',
  description: 'Sign in to your MarketPay account.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoadingState label="Loading sign in…" />}>
      <LoginForm />
    </Suspense>
  );
}
