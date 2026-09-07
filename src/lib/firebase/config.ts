/**
 * Firebase client bootstrap.
 *
 * Configuration is read from public, build-time environment variables
 * (`NEXT_PUBLIC_FIREBASE_*`). When a full config is present the app runs in
 * **cloud mode** — Firebase Auth for identity and Cloud Firestore for data.
 * When any required value is missing it falls back to **local mode** (data
 * on this device) so the app still runs in previews and offline development.
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

// Lazily-initialised singletons — never instantiate Firebase on the server and
// never twice under Next.js fast-refresh / HMR.
let _app: import('firebase/app').FirebaseApp | null = null;
let _auth: import('firebase/auth').Auth | null = null;
let _db: import('firebase/firestore').Firestore | null = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured) return null;
  if (typeof window === 'undefined') return null;
  if (_app) return _app;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeApp, getApps } = require('firebase/app') as typeof import('firebase/app');
  _app = getApps().length ? getApps()[0] : initializeApp(envConfig);
  return _app;
}

export function getAuth(): import('firebase/auth').Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (_auth) return _auth;
  const fbAuth = require('firebase/auth') as typeof import('firebase/auth');
  _auth = fbAuth.getAuth(app);
  return _auth;
}

export function getDb(): import('firebase/firestore').Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (_db) return _db;
  const fs = require('firebase/firestore') as typeof import('firebase/firestore');
  _db = fs.getFirestore(app);
  return _db;
}

/** Path of a user's Firestore document root: users/{uid} */
export const userDoc = (uid: string) => `users/${uid}`;
/** Sub-collection path for an array-backed collection, e.g. users/{uid}/sessions */
export const colPath = (uid: string, name: string) => `users/${uid}/${name}`;
