'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseServices, missingFirebaseKeys, isFirebaseConfigured } from './config';
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
  /** Send (or resend) the "confirm your email" link. Best effort. */
  resendVerification: () => Promise<void>;
  /**
   * Prove the password again before a sensitive operation (account
   * deletion). Done *before* the server deletion job starts so a wrong
   * password can never begin an account wipe.
   */
  reauthenticate: (password?: string) => Promise<void>;
  /**
   * Ask the server-owned deletion job to remove Firestore data and the Auth
   * account. The caller must reauthenticate first.
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
  // An empty `missingKeys` here means the config was present but init threw,
  // which is a different failure needing a different message.
  if (!svc) throw Object.assign(new Error(AUTH_UNAVAILABLE), { missingKeys: missingFirebaseKeys });
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
        // Kick off email verification immediately. Best effort: a delivery
        // failure must not block sign-up — the profile screen offers a resend.
        try {
          await fb.sendEmailVerification(cred.user);
        } catch {
          /* non-fatal */
        }
      });
    },
    [run],
  );

  const resendVerification = useCallback(async () => {
    await run(async () => {
      const svc = await requireAuth();
      const current = svc.auth.currentUser;
      if (!current || current.emailVerified) return;
      const fb = await import('firebase/auth');
      await fb.sendEmailVerification(current);
    });
  }, [run]);

  const reauthenticate = useCallback(
    async (password?: string) => {
      await run(async () => {
        const svc = await requireAuth();
        const current = svc.auth.currentUser;
        if (!current) throw new Error('not-signed-in');
        const fb = await import('firebase/auth');

        if (password !== undefined) {
          if (!current.email) throw new Error('password-reauth-unavailable');
          await fb.reauthenticateWithCredential(
            current,
            fb.EmailAuthProvider.credential(current.email, password),
          );
          return;
        }

        // OAuth accounts have no password to collect. Re-authenticate them
        // before any destructive operation as well; a delete flow must never
        // wipe Firestore first and only then discover that Google needs a
        // recent login.
        const google = current.providerData.some((p) => p.providerId === 'google.com');
        if (google) {
          const provider = new fb.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await fb.reauthenticateWithPopup(current, provider);
          return;
        }
        throw Object.assign(new Error('recent-login-required'), {
          code: 'auth/requires-recent-login',
        });
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
    await run(async () => {
      const svc = await requireAuth();
      const current = svc.auth.currentUser;
      if (!current) throw new Error('not-signed-in');

      // Reauthentication happens in the profile flow before this method. Force
      // a fresh ID token so the server job receives the proof of that recent
      // sign-in rather than a stale cached token.
      const token = await current.getIdToken(true);
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        cache: 'no-store',
      });
      let body: { error?: string } = {};
      try {
        body = (await response.json()) as { error?: string };
      } catch {
        // A proxy/platform failure may return no JSON; the status still gives
        // the user a retryable failure rather than silently continuing.
      }
      if (!response.ok) {
        throw new Error(
          body.error ||
            (response.status === 409
              ? 'Account deletion is already in progress. Try again shortly.'
              : 'The server could not finish deleting your account. Try again.'),
        );
      }

      // The Admin SDK has deleted Auth already. Sign out locally so a token
      // cached by the browser cannot keep the deleted account on screen.
      const fb = await import('firebase/auth');
      await fb.signOut(svc.auth);
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
      resendVerification,
      reauthenticate,
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
      resendVerification,
      reauthenticate,
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
