import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

/**
 * Resolve the Firebase Admin SDK once per server process.
 *
 * Production deployments should provide FIREBASE_ADMIN_PROJECT_ID,
 * FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY. Google-hosted
 * runtimes may use Application Default Credentials instead. The service
 * account values are server-only and must never use NEXT_PUBLIC_ variables.
 */
export function getAdminServices(): AdminServices {
  const app = getApps()[0] ?? initializeAdminApp();
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

function initializeAdminApp(): App {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim();

  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (serviceAccountJson) {
    let parsed: ServiceAccount;
    try {
      parsed = JSON.parse(serviceAccountJson) as ServiceAccount;
    } catch {
      throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT must contain valid JSON.');
    }
    return initializeApp({
      credential: cert(parsed),
      ...(projectId ? { projectId } : {}),
    });
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      ...(projectId ? { projectId } : {}),
    });
  }

  // Firebase App Hosting / Cloud Run / other Google-hosted runtimes expose
  // ADC instead of a private key. Keep this fallback last so a partially
  // pasted service-account configuration fails loudly rather than silently
  // targeting a different project.
  if (clientEmail || privateKey) {
    throw new Error(
      'Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY together, or provide FIREBASE_ADMIN_SERVICE_ACCOUNT.',
    );
  }
  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
}

/**
 * Firestore job records are deliberately outside `users/{uid}`. Client rules
 * deny this collection; only the Admin SDK can create or update it.
 */
export function deletionJobPath(uid: string): string {
  return `accountDeletionJobs/${uid}`;
}
