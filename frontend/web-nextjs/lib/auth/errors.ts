import type { ApiErrorDetail } from './types';

/**
 * A backend or transport failure, already translated into something safe to
 * render. Never carries stack traces, framework exceptions or upstream detail.
 */
export class AuthError extends Error {
  readonly code: string;
  /** Per-field messages keyed by form field name. */
  readonly fieldErrors: Record<string, string>;
  /** Seconds to wait before retrying, when the backend supplies it. */
  readonly retryAfter?: number;
  readonly status: number;
  /** Envelope `meta` from the failed response, e.g. attempts_remaining. */
  readonly meta: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    opts: {
      fieldErrors?: Record<string, string>;
      retryAfter?: number;
      status?: number;
      meta?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.retryAfter = opts.retryAfter;
    this.status = opts.status ?? 0;
    this.meta = opts.meta ?? {};
  }

  get isRetryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'SERVER_ERROR';
  }

  /** True when the user must stop and wait rather than correct their input. */
  get isLockout(): boolean {
    return this.code === 'ACCOUNT_LOCKED' || this.code === 'TOO_MANY_ATTEMPTS';
  }

  get attemptsRemaining(): number | null {
    const value = this.meta.attempts_remaining;
    return typeof value === 'number' ? value : null;
  }
}

/**
 * Human-readable copy per error code. Deliberately vague where a precise
 * message would leak whether an account exists or why it was blocked.
 */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'That phone number and password combination is not correct.',
  ACCOUNT_LOCKED:
    'This account is temporarily locked for security. Please try again later or reset your password.',
  ACCOUNT_SUSPENDED: 'This account is not available. Contact MarketPay support for help.',
  ACCOUNT_NOT_VERIFIED: 'Verify your phone number to continue.',
  INVALID_OTP: 'That code is not correct. Check it and try again.',
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Try again in 15 minutes.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  MFA_EXPIRED: 'Your verification session timed out. Sign in again.',
  SESSION_EXPIRED: 'Your session has ended. Sign in again to continue.',
  PHONE_TAKEN: 'This phone number is already registered. Try signing in instead.',
  EMAIL_TAKEN: 'This email address is already registered.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  UNSUPPORTED_FILE: 'That file type is not accepted. Upload one of the listed formats.',
  NETWORK_ERROR: 'Unable to connect to MarketPay. Check your connection and try again.',
  SERVER_ERROR: 'Something went wrong on our side. Please try again in a moment.',
};

export function messageFor(code: string, fallback?: string): string {
  return MESSAGES[code] ?? fallback ?? MESSAGES.SERVER_ERROR;
}

/** Turn an envelope's `errors[]` into a single AuthError safe for display. */
export function normalizeErrors(
  status: number,
  errors: ApiErrorDetail[] | undefined,
  retryAfter?: number,
  meta?: Record<string, unknown>
): AuthError {
  const list = errors ?? [];
  const fieldErrors: Record<string, string> = {};
  for (const e of list) {
    if (e.field && e.message) fieldErrors[e.field] = e.message;
  }

  const primary = list.find((e) => !e.field) ?? list[0];
  let code = primary?.error_code;

  if (!code) {
    if (status === 401) code = 'INVALID_CREDENTIALS';
    else if (status === 403) code = 'ACCOUNT_SUSPENDED';
    else if (status === 429) code = 'RATE_LIMITED';
    else if (status === 400 || status === 422) code = 'VALIDATION_ERROR';
    else code = 'SERVER_ERROR';
  }

  // A server-supplied message is only trusted for codes we do not own copy for,
  // so internal detail can never reach the screen for known failures.
  const fallback = MESSAGES[code] ? undefined : primary?.message;
  return new AuthError(code, messageFor(code, fallback), {
    fieldErrors,
    retryAfter,
    status,
    meta,
  });
}
