'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import { getAuth, isFirebaseConfigured } from './config';

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
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled in this Firebase project.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const mode: AuthMode = isFirebaseConfigured ? 'cloud' : 'local';

  useEffect(() => {
    if (mode !== 'cloud') {
      setInitializing(false);
      return;
    }
    const auth = getAuth();
    if (!auth) {
      setInitializing(false);
      return;
    }
    const { onAuthStateChanged } = require('firebase/auth') as typeof import('firebase/auth');
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setInitializing(false);
      },
      () => setInitializing(false),
    );
    return () => unsub();
  }, [mode]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setAuthError(null);
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
      const auth = getAuth();
      if (!auth) throw new Error('auth-unavailable');
      const fb = require('firebase/auth') as typeof import('firebase/auth');
      await run(async () => {
        const cred = await fb.createUserWithEmailAndPassword(auth, email, password);
        if (displayName && cred.user) {
          await fb.updateProfile(cred.user, { displayName });
        }
      });
    },
    [run],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const auth = getAuth();
      if (!auth) throw new Error('auth-unavailable');
      const fb = require('firebase/auth') as typeof import('firebase/auth');
      await run(() => fb.signInWithEmailAndPassword(auth, email, password));
    },
    [run],
  );

  const signInWithGoogle = useCallback(async () => {
    const auth = getAuth();
    if (!auth) throw new Error('auth-unavailable');
    const fb = require('firebase/auth') as typeof import('firebase/auth');
    await run(() => {
      const provider = new fb.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return fb.signInWithPopup(auth, provider);
    });
  }, [run]);

  const signOut = useCallback(async () => {
    const auth = getAuth();
    if (!auth) return;
    const fb = require('firebase/auth') as typeof import('firebase/auth');
    await fb.signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      user,
      initializing,
      loading,
      authError,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      clearError: () => setAuthError(null),
    }),
    [mode, user, initializing, loading, authError, signUp, signIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
