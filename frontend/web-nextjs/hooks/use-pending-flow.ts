'use client';

import { useSyncExternalStore } from 'react';
import { readPendingRegistration, readPendingReset } from '@/lib/auth/pending-flow';

/**
 * Session storage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state on mount.
 *
 * `undefined` means "not resolved yet" (server render and first hydration
 * pass); `null` means "there is no flow in progress". Screens must not act on
 * the difference until the value stops being undefined, or they would redirect
 * a user who does in fact have a flow open.
 */
const neverChanges = () => () => {};
const unresolved = () => undefined;

export function usePendingRegistration() {
  return useSyncExternalStore(neverChanges, readPendingRegistration, unresolved);
}

export function usePendingReset() {
  return useSyncExternalStore(neverChanges, readPendingReset, unresolved);
}
