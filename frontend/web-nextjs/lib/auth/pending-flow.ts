import type { OtpChallenge, PublicRole } from './types';

/**
 * The little that has to survive a hop between two authentication screens.
 * Deliberately no password and no token — only what the next screen must show.
 */
export interface PendingRegistration {
  phoneNumber: string;
  destinationMasked: string;
  role: PublicRole;
  expiresAt?: string | null;
  resendAfter?: number;
}

export interface PendingReset {
  phoneNumber: string;
  destinationMasked: string;
  expiresAt?: string | null;
  resendAfter?: number;
}

const REGISTRATION_KEY = 'marketpay.registration.pending';
const RESET_KEY = 'marketpay.reset.pending';

/**
 * Parsed values are cached against the exact string they came from, so repeated
 * reads return the same object identity while the stored value is unchanged.
 * useSyncExternalStore compares snapshots by identity, and a fresh parse on
 * every call would re-render forever; keying on the raw string means storage
 * cleared elsewhere is still noticed rather than served from a stale cache.
 */
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  snapshots.set(key, { raw, value });
  try {
    window.sessionStorage.setItem(key, raw);
  } catch {
    // Storage can be unavailable; the in-memory snapshot still carries the flow.
  }
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = readRaw(key);
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value as T | null;

  let value: T | null = null;
  try {
    value = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    value = null;
  }
  snapshots.set(key, { raw, value });
  return value;
}

function clear(key: string) {
  snapshots.set(key, { raw: null, value: null });
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage was never available.
  }
}

export const savePendingRegistration = (value: PendingRegistration) =>
  write(REGISTRATION_KEY, value);
export const readPendingRegistration = () => read<PendingRegistration>(REGISTRATION_KEY);
export const clearPendingRegistration = () => clear(REGISTRATION_KEY);

export const savePendingReset = (value: PendingReset) => write(RESET_KEY, value);
export const readPendingReset = () => read<PendingReset>(RESET_KEY);
export const clearPendingReset = () => clear(RESET_KEY);

export function pendingFromChallenge(
  phoneNumber: string,
  role: PublicRole,
  challenge: OtpChallenge
): PendingRegistration {
  return {
    phoneNumber,
    role,
    destinationMasked: challenge.destination_masked,
    expiresAt: challenge.expires_at,
    resendAfter: challenge.resend_after,
  };
}
