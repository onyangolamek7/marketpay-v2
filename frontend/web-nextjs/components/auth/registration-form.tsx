'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AuthHeading, Stepper } from '@/components/auth/auth-shell';
import { Alert, SubmitButton } from '@/components/auth/feedback';
import { PasswordChecklist, PasswordField, PhoneField, TextField } from '@/components/auth/fields';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { pendingFromChallenge, savePendingRegistration } from '@/lib/auth/pending-flow';
import { KYC_ROLES, type PublicRole } from '@/lib/auth/types';
import {
  DEFAULT_COUNTRY,
  findCountry,
  toE164,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
} from '@/lib/auth/validation';
import { cn } from '@/lib/utils';

const STEPS = ['Account type', 'Your details', 'Verify phone'];

const ROLE_OPTIONS: { value: PublicRole; title: string; description: string }[] = [
  {
    value: 'consumer',
    title: 'Consumer',
    description: 'Buy food and everyday goods, pay from your wallet and track prices.',
  },
  {
    value: 'retailer',
    title: 'Retailer',
    description: 'Sell to shoppers, take payments and manage your stock.',
  },
  {
    value: 'wholesaler',
    title: 'Wholesaler',
    description: 'Supply retailers in bulk with tiered pricing and group deals.',
  },
  {
    value: 'rider',
    title: 'Rider',
    description: 'Deliver orders, update their status and follow your route.',
  },
];

interface DetailErrors {
  full_name?: string;
  phone_number?: string;
  email?: string;
  password?: string;
  confirm?: string;
  location?: string;
}

export function RegistrationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<PublicRole>('consumer');

  const [fullName, setFullName] = useState('');
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY.iso);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [location, setLocation] = useState('');

  const [errors, setErrors] = useState<DetailErrors>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);

  const emailRequired = role !== 'consumer';
  const needsKyc = KYC_ROLES.includes(role);

  async function submitDetails() {
    if (pending) return;
    const country = findCountry(countryIso);
    const next: DetailErrors = {
      full_name: validateFullName(fullName) ?? undefined,
      phone_number: validatePhone(country, phone) ?? undefined,
      email: validateEmail(email, emailRequired) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: password && confirm !== password ? 'Both passwords must match.' : undefined,
      location: location.trim() ? undefined : 'Tell us your town or county.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setFormError(null);
      return;
    }

    setFormError(null);
    setPending(true);
    const phoneNumber = toE164(country, phone)!;

    try {
      await authApi.register({
        full_name: fullName.trim(),
        phone_number: phoneNumber,
        email: email.trim() || undefined,
        password,
        role,
        location: location.trim(),
      });
      const challenge = await authApi.sendOtp(phoneNumber, 'registration');
      savePendingRegistration(pendingFromChallenge(phoneNumber, role, challenge));
      router.push('/verify-phone');
    } catch (caught) {
      const error =
        caught instanceof AuthError
          ? caught
          : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.');
      setFormError(error);
      setErrors((current) => ({ ...current, ...error.fieldErrors }));
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <Stepper steps={STEPS} current={step} />

      {step === 0 ? (
        <>
          <AuthHeading
            title="Create your MarketPay account"
            description="Pick the account that matches how you will use MarketPay. You can add more later."
          />

          <fieldset className="space-y-3">
            <legend className="sr-only">Account type</legend>
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                    selected
                      ? 'border-action bg-action-tint/50 ring-3 ring-action/15'
                      : 'border-border bg-card hover:border-action/40'
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selected}
                    onChange={() => setRole(option.value)}
                    className="mt-1 size-5 shrink-0 accent-[var(--mp-action)]"
                  />
                  <span>
                    <span className="block font-semibold text-foreground">{option.title}</span>
                    <span className="mt-0.5 block text-sm text-text-muted">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {needsKyc && (
            <Alert tone="info" title="Identity verification needed">
              <p>
                Retailer and wholesaler accounts need identity and business verification before
                selling features switch on. You can start selling as soon as we approve your
                documents.
              </p>
            </Alert>
          )}

          <div className="rounded-xl border border-border bg-card p-4 text-sm text-text-muted">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-food" aria-hidden="true" />
              Government analyst or administrator?
            </p>
            <p className="mt-1">
              Those accounts are created by MarketPay. Ask your organisation&apos;s MarketPay
              contact for an invitation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/40"
          >
            Continue
          </button>

          <p className="text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-action underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setStep(0)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded text-sm font-medium text-action hover:underline disabled:opacity-50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to account type
          </button>

          <AuthHeading
            title="Tell us about you"
            description="We use these details to secure your account and send your verification code."
          />

          {formError && <Alert tone="error">{formError.message}</Alert>}

          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitDetails();
            }}
          >
            <TextField
              id="reg-name"
              label="Full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={errors.full_name}
              autoComplete="name"
              disabled={pending}
              required
            />

            <PhoneField
              id="reg-phone"
              countryIso={countryIso}
              onCountryChange={setCountryIso}
              value={phone}
              onValueChange={setPhone}
              error={errors.phone_number}
              disabled={pending}
              autoComplete="tel"
            />

            <TextField
              id="reg-email"
              label="Email address"
              type="email"
              inputMode="email"
              optional={!emailRequired}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              hint={
                emailRequired
                  ? 'Needed for receipts and account recovery on business accounts.'
                  : 'Useful for receipts and account recovery.'
              }
              autoComplete="email"
              disabled={pending}
            />

            <TextField
              id="reg-location"
              label="Town or county"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              error={errors.location}
              hint="Helps us show prices and deliveries near you."
              autoComplete="address-level2"
              disabled={pending}
              required
            />

            <div className="space-y-3">
              <PasswordField
                id="reg-password"
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                autoComplete="new-password"
                disabled={pending}
                required
              />
              <PasswordChecklist value={password} />
            </div>

            <PasswordField
              id="reg-confirm"
              label="Confirm password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={errors.confirm}
              autoComplete="new-password"
              disabled={pending}
              required
            />

            <SubmitButton pending={pending} pendingLabel="Creating account…">
              Create account
            </SubmitButton>

            <p className="text-center text-sm text-text-muted">
              We will send a 6-digit code to confirm your phone number.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
