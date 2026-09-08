/**
 * Firebase client bootstrap.
 *
 * Configuration is read from public, build-time environment variables
 * (`NEXT_PUBLIC_FIREBASE_*`). When a full config is present the app runs in
 * **cloud mode** — Firebase Auth for identity and Cloud Firestore for data.
 * When any required value is missing it falls back to **local mode** (data
 * on this device) so the app still runs in previews and offline development.
 *
 * Firebase is loaded lazily via dynamic `import()` so it is code-split out of
 * the landing/initial bundle and is only fetched when a user reaches the
 * authenticated app. The services are cached as singletons.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const envConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? undefined,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? undefined,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

/**
 * The four values Firebase Auth + Firestore actually need. `storageBucket` and
 * `messagingSenderId` are only used by Cloud Storage and FCM, neither of which
 * this app calls, so they are deliberately not required.
 *
 * Reported by name: "missing configuration" is otherwise indistinguishable
 * from "configured for a different environment" or "added after the last
 * build", which are the two ways this actually goes wrong on Vercel.
 */
const REQUIRED_ENV: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: envConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: envConfig.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: envConfig.projectId,
  NEXT_PUBLIC_FIREBASE_APP_ID: envConfig.appId,
};

/** Names of the required variables that were empty in *this build*. */
export const missingFirebaseKeys: string[] = Object.entries(REQUIRED_ENV)
  // Trim: a variable pasted with a stray newline is present but useless, and
  // would otherwise pass the check and fail later inside the SDK.
  .filter(([, value]) => !value.trim())
  .map(([key]) => key);

/** True when enough config is present to initialise Firebase. */
export const isFirebaseConfigured: boolean = missingFirebaseKeys.length === 0;

export interface FirebaseServices {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
}

let _services: Promise<FirebaseServices | null> | null = null;

/**
 * Lazily initialise Firebase and resolve the Auth + Firestore services.
 * Returns null in local mode, on the server, or if initialisation fails.
 * Safe to call repeatedly — the initialisation promise is cached.
 */
export function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (_services) return _services;

  _services = (async () => {
    try {
      const [{ initializeApp, getApps }, { getAuth }, firestore] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = getApps().length ? getApps()[0] : initializeApp(envConfig);

      // Abuse protection. App Check attests that traffic comes from the real
      // app on an authorised domain, which is what stops scripts from using
      // the (necessarily public) API key to farm Auth signups and Firestore
      // ops. Optional: register a reCAPTCHA v3 key under Firebase → App Check
      // and set NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY, then enable
      // enforcement in the console. Without the key everything still works —
      // requests are simply unattested (today's behaviour).
      const appCheckKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY?.trim() ?? '';
      if (appCheckKey) {
        try {
          const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
          await initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(appCheckKey),
          });
        } catch (err) {
          // Never block the app on App Check; log and continue unattested.
          console.warn('[smartfit] App Check unavailable:', err);
        }
      }

      const auth = getAuth(app);

      // Persistent IndexedDB cache: reads are served locally when the network
      // is unavailable and writes are replayed on reconnect. Multi-tab manager
      // keeps several open tabs consistent instead of one silently losing the
      // lease. Falls back to the default in-memory cache if the browser
      // refuses IndexedDB (private mode, storage disabled, unsupported).
      let db: import('firebase/firestore').Firestore;
      try {
        db = firestore.initializeFirestore(app, {
          localCache: firestore.persistentLocalCache({
            tabManager: firestore.persistentMultipleTabManager(),
          }),
        });
      } catch {
        db = firestore.getFirestore(app);
      }

      return { auth, db };
    } catch (err) {
      console.error('[smartfit] Firebase init failed:', err);
      _services = null; // allow a retry on a later call
      return null;
    }
  })();

  return _services;
}

/** Path of a user's Firestore document root: users/{uid} */
export const userDoc = (uid: string) => `users/${uid}`;
/** Sub-collection path for an array-backed collection, e.g. users/{uid}/sessions */
export const colPath = (uid: string, name: string) => `users/${uid}/${name}`;
