/**
 * Firebase client bootstrap for the native app.
 *
 * Mirrors `src/lib/firebase/config.ts` on the web: when a full config is
 * present the app runs in **cloud mode** (Firebase Auth + Firestore); when any
 * required value is missing it falls back to **local mode** (data stays on this
 * device), so a build with no backend still works.
 *
 * Differences from the web version, both forced by the platform:
 *
 *  - Unity of config source. Expo inlines `EXPO_PUBLIC_*` at build time, so
 *    these come from the same `EXPO_PUBLIC_FIREBASE_*` names used by
 *    `eas.json` / the EAS environment. They are *public* values by design (a
 *    Firebase web config is not a secret); access control lives in Firestore
 *    rules, not in hiding the API key.
 *  - Auth persistence. React Native has no `localStorage`, so the SDK is
 *    initialised through `initializeAuth` with `getReactNativePersistence`
 *    backed by AsyncStorage. Without this the session would be dropped on every
 *    app restart and the user would be asked to sign in each launch.
 *  - `signInWithPopup` does not exist on native. Google sign-in uses
 *    `expo-auth-session` (see `auth-context.tsx`).
 *
 * Firebase is loaded with dynamic `import()` so it is code-split out of the
 * local-mode bundle entirely.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const envObj = ((typeof process !== 'undefined' && process.env) || {}) as Record<
  string,
  string | undefined
>;

export const firebaseConfig: FirebaseConfig = {
  apiKey: envObj.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: envObj.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: envObj.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: envObj.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envObj.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envObj.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/**
 * The four values Auth + Firestore actually require. Reported by name, because
 * "missing configuration" is otherwise indistinguishable from "configured for a
 * different environment" or "added after the last build was cut".
 */
const REQUIRED_ENV: Record<string, string> = {
  EXPO_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  EXPO_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
};

/** Names of the required variables that were empty in *this* build. */
export const missingFirebaseKeys: string[] = Object.entries(REQUIRED_ENV)
  // Trim: a value pasted with a stray newline is present but useless, and would
  // otherwise pass the check and fail later inside the SDK.
  .filter(([, value]) => !value.trim())
  .map(([key]) => key);

/** True when enough config is present to initialise Firebase. */
export const isFirebaseConfigured: boolean = missingFirebaseKeys.length === 0;

export interface FirebaseServices {
  auth: import('firebase/auth').Auth;
}

let servicesPromise: Promise<FirebaseServices | null> | null = null;

/**
 * Initialise (once) and return the Firebase services, or `null` when the
 * deployment has no config.
 *
 * The whole module is imported lazily: a local-mode install never downloads the
 * Firebase SDK, and `firebase/auth` is only evaluated inside a configured build.
 */
export function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  servicesPromise ??= (async () => {
    /**
     * `firebase/auth` is a thin runtime re-export of `@firebase/auth`, but its
     * published typings are the browser ones. Those omit the React Native
     * persistence API (`getReactNativePersistence`), and TypeScript cannot see
     * `@firebase/auth`'s "react-native" export condition because the `types`
     * key wins. The runtime object does export it — Metro resolves
     * `@firebase/auth`'s `react-native` condition to `dist/rn/index.js` — so we
     * describe the two RN-only members we rely on instead of casting the whole
     * namespace to `any`.
     */
    type ReactNativeAuthModule = {
      initializeAuth: typeof import('firebase/auth').initializeAuth;
      getAuth: typeof import('firebase/auth').getAuth;
      getReactNativePersistence: (storage: unknown) => import('firebase/auth').Persistence;
    };

    const [{ initializeApp, getApps, getApp }, authModule] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth') as unknown as Promise<ReactNativeAuthModule>,
    ]);
    const { initializeAuth, getAuth, getReactNativePersistence } = authModule;
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    // `initializeAuth` throws when called twice for the same app, which happens
    // on Fast Refresh. Falling back to `getAuth` keeps the existing instance.
    let auth;
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      auth = getAuth(app);
    }

    return { auth };
  })().catch(() => null);
  return servicesPromise;
}
