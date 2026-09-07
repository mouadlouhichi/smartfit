'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseServices, isFirebaseConfigured } from './config';
import { AUTH_UNAVAILABLE, friendlyAuthError, isSilentResetMiss } from './auth-errors';

export type AuthMode = 'cloud' | 'local';

interface AuthContextValue {
  /** 'cloud' when Firebase is configured & active, otherwise 'local'. */
  mode: AuthMode;
  /** The signed-in Firebase user, or null (also null in local mode). */
  user: User | null;
  /** True until the initial auth state has resolved. */
  initializing: boolean;
  loading: boolean;
  authError: string | null;
  authInfo: string | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Permanently delete the Firebase Auth account. Firestore data must be
   * wiped first — see `useStore().clearData()`.
   */
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolve the Firebase services or fail loudly.
 *
 * Callers must invoke this *inside* `run()`. It used to be thrown before the
 * wrapper, which meant a deployment with no Firebase credentials produced a
 * rejected promise that nothing translated and nothing displayed — the sign-in
 * button simply did nothing at all.
 */
async function requireAuth() {
  const svc = await getFirebaseServices();
  if (!svc) throw new Error(AUTH_UNAVAILABLE);
  return svc;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  const mode: AuthMode = isFirebaseConfigured ? 'cloud' : 'local';

  useEffect(() => {
    if (mode !== 'cloud') {
      setInitializing(false);
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;

    getFirebaseServices().then(async (svc) => {
      if (cancelled) return;
      if (!svc) {
        setInitializing(false);
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(
        svc.auth,
        (u) => {
          setUser(u);
          setInitializing(false);
        },
        () => setInitializing(false),
      );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [mode]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setAuthError(null);
    setAuthInfo(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setAuthError(friendlyAuthError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      await run(async () => {
        const svc = await requireAuth();
        const fb = await import('firebase/auth');
        const cred = await fb.createUserWithEmailAndPassword(svc.auth, email, password);
        if (displayName && cred.user) {
          await fb.updateProfile(cred.user, { displayName });
        }
      });
    },
    [run],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await run(async () => {
        const svc = await requireAuth();
        const fb = await import('firebase/auth');
        await fb.signInWithEmailAndPassword(svc.auth, email, password);
      });
    },
    [run],
  );

  const signInWithGoogle = useCallback(async () => {
    await run(async () => {
      const svc = await requireAuth();
      const fb = await import('firebase/auth');
      const provider = new fb.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await fb.signInWithPopup(svc.auth, provider);
    });
  }, [run]);

  const resetPassword = useCallback(
    async (email: string) => {
      await run(async () => {
        const svc = await requireAuth();
        const fb = await import('firebase/auth');
        // Treat "no such account" as success. Reporting it would (a) confirm
        // to an attacker which emails are registered, and (b) surface through
        // friendlyError as "Incorrect email or password.", which is nonsense
        // on a form that has no password field. Firebase's own email
        // enumeration protection behaves the same way.
        try {
          await fb.sendPasswordResetEmail(svc.auth, email);
        } catch (err) {
          if (!isSilentResetMiss(err)) throw err;
        }
        setAuthInfo(`If an account exists for ${email}, a reset link is on its way.`);
      });
    },
    [run],
  );

  const signOut = useCallback(async () => {
    const svc = await getFirebaseServices();
    if (!svc) return;
    const fb = await import('firebase/auth');
    await fb.signOut(svc.auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    const svc = await getFirebaseServices();
    if (!svc) throw new Error('auth-unavailable');
    const current = svc.auth.currentUser;
    if (!current) throw new Error('not-signed-in');
    const fb = await import('firebase/auth');

    await run(async () => {
      try {
        await fb.deleteUser(current);
      } catch (err) {
        // Deleting an account is a sensitive operation: Firebase requires a
        // recent sign-in. Re-authenticate in place rather than dead-ending.
        if ((err as { code?: string })?.code !== 'auth/requires-recent-login') throw err;
        const google = current.providerData.some((p) => p.providerId === 'google.com');
        if (!google) throw err; // password users are asked to sign in again
        const provider = new fb.GoogleAuthProvider();
        await fb.reauthenticateWithPopup(current, provider);
        await fb.deleteUser(current);
      }
    });
  }, [run]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      user,
      initializing,
      loading,
      authError,
      authInfo,
      signUp,
      signIn,
      signInWithGoogle,
      resetPassword,
      signOut,
      deleteAccount,
      clearError: () => {
        setAuthError(null);
        setAuthInfo(null);
      },
    }),
    [
      mode,
      user,
      initializing,
      loading,
      authError,
      authInfo,
      signUp,
      signIn,
      signInWithGoogle,
      resetPassword,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
