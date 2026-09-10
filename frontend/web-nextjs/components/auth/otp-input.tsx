'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Fired once six digits are present, so pasting a code submits it. */
  onComplete?: (value: string) => void;
  length?: number;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}

/**
 * One real text input rendered behind six boxes.
 *
 * Keeping a single control means paste, backspace, arrow keys, screen readers
 * and the browser's own SMS autofill all behave the way they normally do, with
 * no per-box focus juggling.
 */
export function OtpInput({
  id,
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  disabled,
  autoFocus,
  label = 'Verification code',
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          autoComplete="one-time-code"
          maxLength={length}
          disabled={disabled}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, length);
            onChange(next);
            if (next.length === length) onComplete?.(next);
          }}
          className="absolute inset-0 z-10 h-full w-full cursor-text tracking-[3rem] text-transparent caret-transparent opacity-0 outline-none"
        />
        <div aria-hidden="true" className="flex gap-2 sm:gap-3">
          {digits.map((digit, index) => (
            <div
              key={index}
              className={cn(
                'flex h-14 flex-1 items-center justify-center rounded-xl border bg-background text-2xl font-semibold tabular-nums text-foreground transition-colors',
                error ? 'border-danger' : 'border-border',
                focused && index === activeIndex && !disabled && 'border-action ring-3 ring-action/25',
                disabled && 'opacity-60'
              )}
            >
              {digit.trim()}
            </div>
          ))}
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </div>
  );
}
