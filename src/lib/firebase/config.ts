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

/** True when enough config is present to initialise Firebase. */
export const isFirebaseConfigured: boolean = Boolean(
  envConfig.apiKey && envConfig.projectId && envConfig.appId && envConfig.authDomain,
);

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
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = getApps().length ? getApps()[0] : initializeApp(envConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
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
