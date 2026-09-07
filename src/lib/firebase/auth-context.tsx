'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseServices, isFirebaseConfigured } from './config';

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

/** Turn a Firebase auth error code into a short human message. */
function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email. Try signing in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up was blocked — allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled in this Firebase project.';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a moment and try again.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again before deleting your account.';
    default:
      return 'Something went wrong. Please try again.';
  }
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
      setAuthError(friendlyError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const svc = await getFirebaseServices();
      if (!svc) throw new Error('auth-unavailable');
      const fb = await import('firebase/auth');
      await run(async () => {
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
      const svc = await getFirebaseServices();
      if (!svc) throw new Error('auth-unavailable');
      const fb = await import('firebase/auth');
      await run(() => fb.signInWithEmailAndPassword(svc.auth, email, password));
    },
    [run],
  );

  const signInWithGoogle = useCallback(async () => {
    const svc = await getFirebaseServices();
    if (!svc) throw new Error('auth-unavailable');
    const fb = await import('firebase/auth');
    await run(() => {
      const provider = new fb.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return fb.signInWithPopup(svc.auth, provider);
    });
  }, [run]);

  const resetPassword = useCallback(
    async (email: string) => {
      const svc = await getFirebaseServices();
      if (!svc) throw new Error('auth-unavailable');
      const fb = await import('firebase/auth');
      await run(async () => {
        await fb.sendPasswordResetEmail(svc.auth, email);
        setAuthInfo(`Password reset link sent to ${email}. Check your inbox.`);
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
