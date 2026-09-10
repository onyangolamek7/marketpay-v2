'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { deriveState } from '@/lib/auth/routes';
import type { AuthState, MfaChallenge, MfaType, User } from '@/lib/auth/types';

/** Masked destinations and an expiry only — safe to survive a page reload. */
const CHALLENGE_KEY = 'marketpay.mfa.challenge';

interface AuthContextValue {
  user: User | null;
  state: AuthState;
  challenge: MfaChallenge | null;
  login: (
    phoneNumber: string,
    password: string
  ) => Promise<{ status: 'authenticated'; user: User } | { status: 'mfa_required' }>;
  sendMfaChallenge: (method: MfaType) => Promise<void>;
  verifyMfa: (method: MfaType, code: string) => Promise<User>;
  /** Adopt the session established by a flow that already returned a user. */
  adoptSession: (user: User) => void;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredChallenge(): MfaChallenge | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CHALLENGE_KEY);
    return raw ? (JSON.parse(raw) as MfaChallenge) : null;
  } catch {
    return null;
  }
}

function storeChallenge(challenge: MfaChallenge | null) {
  try {
    if (challenge) window.sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
    else window.sessionStorage.removeItem(CHALLENGE_KEY);
  } catch {
    // Private browsing modes can refuse storage; the flow still works in-memory.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const next = await authApi.me();
      setUser(next);
      return next;
    } catch {
      // A missing or expired session is an expected outcome here, not a failure.
      setUser(null);
      return null;
    }
  }, []);

  // Resolving the session is asynchronous, so the stored challenge is picked up
  // in the same completion rather than written into state on mount.
  useEffect(() => {
    let cancelled = false;
    void authApi
      .me()
      .then(
        (next) => next,
        () => null
      )
      .then((next) => {
        if (cancelled) return;
        setUser(next);
        setChallenge(readStoredChallenge());
        setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const result = await authApi.login(phoneNumber, password);
    if (result.mfa_required) {
      setChallenge(result.challenge);
      storeChallenge(result.challenge);
      return { status: 'mfa_required' as const };
    }
    setUser(result.user);
    setChallenge(null);
    storeChallenge(null);
    return { status: 'authenticated' as const, user: result.user };
  }, []);

  const sendMfaChallenge = useCallback(async (method: MfaType) => {
    await authApi.sendMfaChallenge(method);
  }, []);

  const verifyMfa = useCallback(async (method: MfaType, code: string) => {
    const result = await authApi.verifyMfa(method, code);
    setUser(result.user);
    setChallenge(null);
    storeChallenge(null);
    return result.user;
  }, []);

  const adoptSession = useCallback((next: User) => {
    setUser(next);
    setChallenge(null);
    storeChallenge(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Signing out must always clear the client, even if the call failed.
      if (!(error instanceof AuthError)) throw error;
    } finally {
      setUser(null);
      setChallenge(null);
      storeChallenge(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    let state: AuthState = deriveState(user);
    if (initializing) state = 'INITIALIZING';
    else if (!user && challenge) state = 'MFA_REQUIRED';
    return {
      user,
      state,
      challenge,
      login,
      sendMfaChallenge,
      verifyMfa,
      adoptSession,
      refreshUser,
      logout,
    };
  }, [
    user,
    challenge,
    initializing,
    login,
    sendMfaChallenge,
    verifyMfa,
    adoptSession,
    refreshUser,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
