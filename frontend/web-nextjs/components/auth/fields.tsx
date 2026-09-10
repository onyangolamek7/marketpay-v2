'use client';

import { useId, useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES, PASSWORD_RULES, findCountry, type Country } from '@/lib/auth/validation';

const controlClass =
  'block w-full rounded-lg border border-border bg-background px-3.5 text-base text-foreground ' +
  'placeholder:text-text-light transition-colors min-h-12 py-2.5 ' +
  'focus-visible:border-action focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  /** ids of the hint/error nodes, wired by the caller into the control. */
  describedBy?: string;
}

export function Field({ label, htmlFor, error, hint, optional, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {optional && <span className="ml-1 font-normal text-text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-danger"
        >
          {/* Never colour alone: the marker carries the meaning too. */}
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string | null, hint?: unknown) {
  const parts = [error ? `${id}-error` : null, !error && hint ? `${id}-hint` : null];
  const value = parts.filter(Boolean).join(' ');
  return value || undefined;
}

type InputProps = Omit<React.ComponentProps<'input'>, 'id'> & {
  label: string;
  id: string;
  error?: string | null;
  hint?: React.ReactNode;
  optional?: boolean;
};

export function TextField({ label, id, error, hint, optional, className, ...props }: InputProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, className)}
        {...props}
      />
    </Field>
  );
}

export function PasswordField({ label, id, error, hint, className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass, 'pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/25"
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          <span className="sr-only">{visible ? 'Hide password' : 'Show password'}</span>
        </button>
      </div>
    </Field>
  );
}

interface PhoneFieldProps {
  id: string;
  label?: string;
  countryIso: string;
  onCountryChange: (iso: string) => void;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
}

export function PhoneField({
  id,
  label = 'Phone number',
  countryIso,
  onCountryChange,
  value,
  onValueChange,
  error,
  disabled,
  autoFocus,
  autoComplete = 'tel-national',
  onBlur,
}: PhoneFieldProps) {
  const country: Country = findCountry(countryIso);
  const hint = `We send your verification code by SMS. Example: ${country.example}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="flex gap-2">
        <div className="relative">
          <label htmlFor={`${id}-country`} className="sr-only">
            Country
          </label>
          <select
            id={`${id}-country`}
            value={country.iso}
            disabled={disabled}
            onChange={(event) => onCountryChange(event.target.value)}
            className={cn(controlClass, 'w-[7.5rem] pr-2')}
          >
            {COUNTRIES.map((item) => (
              <option key={item.iso} value={item.iso}>
                {item.flag} {item.dial}
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onValueChange(event.target.value.replace(/[^\d\s-]/g, ''))}
          placeholder={country.example}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass, 'flex-1')}
        />
      </div>
    </Field>
  );
}

export function PasswordChecklist({ value }: { value: string }) {
  const listId = useId();
  return (
    <ul
      id={listId}
      aria-label="Password requirements"
      aria-live="polite"
      className="grid gap-1.5 sm:grid-cols-2"
    >
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2 text-sm',
              passed ? 'text-success' : 'text-text-muted'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border',
                passed ? 'border-success bg-success text-white' : 'border-border'
              )}
            >
              {passed && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span>{rule.label}</span>
            <span className="sr-only">{passed ? ' — met' : ' — not met yet'}</span>
          </li>
        );
      })}
    </ul>
  );
}

type SelectProps = Omit<React.ComponentProps<'select'>, 'id'> & {
  label: string;
  id: string;
  error?: string | null;
  hint?: React.ReactNode;
};

export function SelectField({ label, id, error, hint, className, children, ...props }: SelectProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({
  id,
  label,
  ...props
}: Omit<React.ComponentProps<'input'>, 'id' | 'type'> & { id: string; label: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-sm text-foreground">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 rounded border-border text-action accent-[var(--mp-action)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
