import type { Metadata } from 'next';
import { RegistrationForm } from '@/components/auth/registration-form';

export const metadata: Metadata = {
  title: 'Create account · MarketPay',
  description: 'Open a MarketPay account for payments, marketplace and delivery.',
};

export default function RegisterPage() {
  return <RegistrationForm />;
}
