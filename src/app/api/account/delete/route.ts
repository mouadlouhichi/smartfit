import { deleteFeatureAccountData } from '@/lib/feature-account-data';
import { getAdminServices, deletionJobPath } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTIVE_LOCK_MS = 10 * 60 * 1000;
const RECENT_LOGIN_MS = 10 * 60 * 1000;

type DeletionStatus = 'running' | 'firestore-cleaned' | 'failed' | 'completed';

class DeletionBusyError extends Error {
  constructor() {
    super('A deletion is already in progress.');
    this.name = 'DeletionBusyError';
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

/** A bearer token is not sent automatically by another site, but keep the
 * same-origin check so a browser cannot be tricked into invoking this route
 * with a token held by application code. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function bearerToken(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token || null;
}

function isKnownUserError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'auth/user-not-found';
}

function safeMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 300) : 'Unknown deletion error';
}

/**
 * Claim a deletion job without letting two tabs run the destructive operation
 * concurrently. A stale running job is reclaimable: a crashed request must not
 * make an account undeletable forever.
 */
async function claimJob(
  db: ReturnType<typeof getAdminServices>['db'],
  uid: string,
): Promise<{ status: DeletionStatus; attempts: number }> {
  const ref = db.doc(deletionJobPath(uid));
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.exists ? (snapshot.data() as Record<string, unknown>) : {};
    const status = data.status as DeletionStatus | undefined;
    if (status === 'completed') return { status, attempts: Number(data.attempts) || 0 };

    const startedAt = typeof data.startedAt === 'number' ? data.startedAt : 0;
    if (status === 'running' && now - startedAt < ACTIVE_LOCK_MS) {
      throw new DeletionBusyError();
    }

    const attempts = (Number(data.attempts) || 0) + 1;
    const resumeAfterFirestoreCleanup = status === 'firestore-cleaned';
    tx.set(
      ref,
      {
        uid,
        status: 'running',
        attempts,
        startedAt: now,
        updatedAt: now,
        ...(status === 'failed' ? { lastError: null } : {}),
      },
      { merge: true },
    );
    // The stored status is running (the lock), while the return value tells
    // this request whether the previous attempt already removed Firestore.
    return {
      status: resumeAfterFirestoreCleanup ? 'firestore-cleaned' : 'running',
      attempts,
    };
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);

  const token = bearerToken(req);
  if (!token) return json({ error: 'A signed-in account is required.' }, 401);

  let services: ReturnType<typeof getAdminServices>;
  try {
    services = getAdminServices();
  } catch (err) {
    console.error('[account-delete] Admin SDK unavailable:', safeMessage(err));
    return json(
      {
        error: 'Account deletion is temporarily unavailable. No data was changed; try again later.',
        retryable: true,
      },
      503,
    );
  }

  let uid: string;
  try {
    // This proves both identity and that the bearer token was issued by this
    // Firebase project. Revocation checks are intentionally omitted: a token
    // that is still valid may finish a deletion after a transient client
    // disconnect, and the job record makes the operation idempotent.
    const decoded = await services.auth.verifyIdToken(token);
    const authTime = Number(decoded.auth_time) * 1000;
    if (!Number.isFinite(authTime) || Date.now() - authTime > RECENT_LOGIN_MS) {
      return json({ error: 'Sign in again to confirm account deletion.' }, 401);
    }
    uid = decoded.uid;
  } catch {
    return json({ error: 'Your sign-in has expired. Sign in again, then retry.' }, 401);
  }

  const jobRef = services.db.doc(deletionJobPath(uid));
  let claim: { status: DeletionStatus; attempts: number };
  try {
    claim = await claimJob(services.db, uid);
  } catch (err) {
    if (err instanceof DeletionBusyError) {
      return json(
        { error: 'Account deletion is already in progress. Wait a moment and try again.' },
        409,
      );
    }
    console.error(`[account-delete:${uid}] Could not claim job:`, safeMessage(err));
    return json(
      {
        error: 'Could not start account deletion. No data was changed; try again.',
        retryable: true,
      },
      503,
    );
  }

  if (claim.status === 'completed') return json({ ok: true, alreadyComplete: true });

  try {
    // A previous attempt may have removed every user document but lost the
    // response before deleting Auth. Do not repeat a potentially long wipe.
    if (claim.status !== 'firestore-cleaned') {
      await deleteFeatureAccountData(services.db, uid);
      await services.db.recursiveDelete(services.db.doc(`users/${uid}`));
      await jobRef.set(
        {
          status: 'firestore-cleaned',
          firestoreDeletedAt: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    }
  } catch (err) {
    console.error(`[account-delete:${uid}] Firestore cleanup failed:`, safeMessage(err));
    await jobRef
      .set(
        { status: 'failed', updatedAt: Date.now(), lastError: 'firestore-cleanup-failed' },
        { merge: true },
      )
      .catch(() => undefined);
    return json(
      {
        error:
          'We could not finish deleting your training data. Nothing was charged; retry to continue.',
        retryable: true,
      },
      503,
    );
  }

  try {
    await services.auth.deleteUser(uid);
  } catch (err) {
    // Idempotency: an earlier request may have deleted Auth but failed before
    // recording the final job state.
    if (!isKnownUserError(err)) {
      console.error(`[account-delete:${uid}] Auth deletion failed:`, safeMessage(err));
      await jobRef
        .set(
          { status: 'firestore-cleaned', updatedAt: Date.now(), lastError: 'auth-delete-failed' },
          { merge: true },
        )
        .catch(() => undefined);
      return json(
        {
          error:
            'Your training data is removed, but sign-in cleanup is still pending. Retry this action.',
          retryable: true,
        },
        503,
      );
    }
  }

  await jobRef.set(
    {
      status: 'completed',
      completedAt: Date.now(),
      updatedAt: Date.now(),
      lastError: null,
    },
    { merge: true },
  );
  return json({ ok: true });
}
