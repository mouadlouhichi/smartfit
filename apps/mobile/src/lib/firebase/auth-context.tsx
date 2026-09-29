import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { User } from 'firebase/auth';
import {
  AUTH_UNAVAILABLE,
  AUTH_MESSAGES,
  friendlyAuthError,
  isSilentResetMiss,
} from '@smartfit/core';
import { getFirebaseServices, isFirebaseConfigured, missingFirebaseKeys } from './config';

export type AuthMode = 'cloud' | 'local';

interface AuthContextValue {
  /** 'cloud' when Firebase is configured and active, otherwise 'local'. */
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
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolve the Firebase services or fail loudly.
 *
 * Called *inside* the action wrappers rather than at module scope: a build with
 * no credentials would otherwise produce a rejected promise that nothing
 * translates and nothing displays, and the sign-in button would simply do
 * nothing at all.
 */
async function requireAuth() {
  const svc = await getFirebaseServices();
  if (!svc) throw Object.assign(new Error(AUTH_UNAVAILABLE), { missingKeys: missingFirebaseKeys });
  return svc;
}

/** Description of a native Google OAuth client id, when one is configured. */
const googleClientId = (() => {
  const env = ((typeof process !== 'undefined' && process.env) || {}) as Record<
    string,
    string | undefined
  >;
  return {
    ios: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    android: env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    web: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  };
})();

const hasGoogleClientId = Boolean(
  Platform.OS === 'ios'
    ? googleClientId.ios || googleClientId.web
    : googleClientId.android || googleClientId.web,
);

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
    let cancelled = false;
    let unsub: (() => void) | undefined;

    getFirebaseServices().then(async (svc) => {
      if (cancelled) return;
      if (!svc) {
        setInitializing(false);
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(
        svc.auth,
        (next) => {
          setUser(next);
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

  /**
   * Shared wrapper: one loading flag, one error surface, never a raw throw.
   *
   * `silentResetMiss` is passed explicitly rather than sniffed off the callback
   * name — an anonymously-named arrow has no usable `.name`, which made that
   * check silently dead.
   */
  const run = useCallback(
    async (
      action: (svc: Awaited<ReturnType<typeof requireAuth>>) => Promise<void>,
      opts: { info?: string; silentResetMiss?: boolean } = {},
    ) => {
      setLoading(true);
      setAuthError(null);
      setAuthInfo(null);
      try {
        const svc = await requireAuth();
        await action(svc);
        if (opts.info) setAuthInfo(opts.info);
      } catch (err) {
        // A reset for an unknown address is reported as success on purpose: see
        // `isSilentResetMiss` — otherwise the form leaks which emails exist, and
        // the shared `auth/invalid-credential` code would surface as "Incorrect
        // email or password." on a form that has no password field.
        if (opts.silentResetMiss && isSilentResetMiss(err)) {
          setAuthInfo('If that email is registered, a reset link is on its way.');
        } else {
          setAuthError(friendlyAuthError(err));
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    (email: string, password: string, displayName?: string) =>
      run(async ({ auth }) => {
        const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } =
          await import('firebase/auth');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName?.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        // Best effort: a failed verification mail must not fail the sign-up.
        try {
          await sendEmailVerification(cred.user);
        } catch {
          /* ignore */
        }
      }),
    [run],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      run(async ({ auth }) => {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        await signInWithEmailAndPassword(auth, email, password);
      }),
    [run],
  );

  const resetPassword = useCallback(
    (email: string) =>
      run(
        async ({ auth }) => {
          const { sendPasswordResetEmail } = await import('firebase/auth');
          await sendPasswordResetEmail(auth, email);
        },
        { silentResetMiss: true },
      ),
    [run],
  );

  /**
   * Google sign-in on native goes through the browser, not a popup:
   * `expo-auth-session` opens the OAuth consent page and hands back an ID
   * token, which Firebase then exchanges for a session.
   */
  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const svc = await requireAuth();
      if (!hasGoogleClientId) {
        setAuthError(
          'Google sign-in is not configured for the native app yet. Add EXPO_PUBLIC_GOOGLE_*_CLIENT_ID.',
        );
        return;
      }

      const [AuthSession, { GoogleAuthProvider, signInWithCredential }] = await Promise.all([
        import('expo-auth-session'),
        import('firebase/auth'),
      ]);

      const clientId =
        Platform.OS === 'ios'
          ? googleClientId.ios || googleClientId.web
          : googleClientId.android || googleClientId.web;

      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'smartfit' });
      const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        scopes: ['openid', 'profile', 'email'],
        extraParams: { nonce: 'smartfit' },
      });

      const result = await request.promptAsync(discovery);
      if (result.type !== 'success') {
        setAuthError(AUTH_MESSAGES.cancelled);
        return;
      }
      const idToken = result.params.id_token;
      if (!idToken) {
        setAuthError(AUTH_MESSAGES.generic);
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(svc.auth, credential);
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      // Never touch Firebase in local mode: there is no account to sign out of.
      if (mode === 'cloud') {
        const svc = await getFirebaseServices();
        if (svc) {
          const { signOut: fbSignOut } = await import('firebase/auth');
          await fbSignOut(svc.auth);
        }
      }
      setUser(null);
    } catch {
      setAuthError(AUTH_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const clearError = useCallback(() => {
    setAuthError(null);
    setAuthInfo(null);
  }, []);

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
      clearError,
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
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
