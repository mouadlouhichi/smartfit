/**
 * Reading an account, and what to do when it fails.
 *
 * Sign-in hydration reads nine things at once. Until now a single failing
 * read — most often one collection the deployed security rules do not grant —
 * rejected the whole batch, and with no cached copy the athlete got a dead
 * end that said "check your connection". Retrying could never work: Firestore
 * had already answered "you may never read this". Someone whose rules were
 * one deploy behind lost access to their entire account.
 *
 * The rules that come out of that:
 *
 *  1. A **permanent** refusal (`permission-denied`) on a secondary collection
 *     costs that collection, not the account. It degrades to empty, is
 *     reported to the caller, and the UI says which slice is missing.
 *  2. A **transient** failure (`unavailable`, a timeout, going offline) still
 *     throws. That distinction is the safety property, not a nicety: a
 *     half-read account rendered as "your history is empty" invites the user
 *     to re-enter data that is merely unreachable. Offline keeps the existing
 *     cached-copy path.
 *  3. Whatever does reach the athlete names the actual cause, so "check your
 *     connection" stops being a lie told about a rules problem.
 */

/** The Firestore error code, or `''` when this is not a Firestore error. */
export function firestoreErrorCode(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' ? code : '';
}

/**
 * Firestore positively refused this read on this client.
 *
 * Permanent by construction: the same request from the same account will be
 * refused again, so retrying is not a recovery strategy — fixing the rules is.
 */
export function isPermissionDenied(err: unknown): boolean {
  return firestoreErrorCode(err) === 'permission-denied';
}

/** The session is gone. Recoverable, but only by signing in again. */
export function isUnauthenticated(err: unknown): boolean {
  return firestoreErrorCode(err) === 'unauthenticated';
}

/**
 * Worth retrying: the request never got a verdict.
 *
 * `''` counts because a bare `TypeError: Failed to fetch` (no code at all) is
 * how a dropped connection usually surfaces.
 */
export function isTransientLoadError(err: unknown): boolean {
  const code = firestoreErrorCode(err);
  return (
    code === '' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    code === 'cancelled' ||
    code === 'internal'
  );
}

/**
 * What to tell the athlete when the account could not be loaded at all.
 *
 * The old copy blamed the connection for every failure, which sent people to
 * reboot a router over a permissions problem. Each branch here is a different
 * action: sign in again, deploy the rules, wait for quota, check the network.
 */
export function describeLoadFailure(err: unknown): string {
  const code = firestoreErrorCode(err);

  if (isPermissionDenied(err)) {
    return "This project's database rules don't allow reading your account. An operator can fix this with `firebase deploy --only firestore:rules` from the current code.";
  }
  if (isUnauthenticated(err)) {
    return 'Your session expired. Sign in again to load your account.';
  }
  if (code === 'failed-precondition') {
    return 'The database is missing a required index. An operator can deploy it with `firebase deploy --only firestore:indexes`.';
  }
  if (code === 'resource-exhausted') {
    return 'The cloud quota for this project is exhausted. Try again later.';
  }
  if (code === 'unauthenticated' || code === 'invalid-argument') {
    return 'The request was refused. Sign in again and retry.';
  }
  return "We couldn't load your account. Check your connection and try again.";
}

/**
 * Run one read, and let a *permanent* refusal fall back instead of killing
 * the whole hydration.
 *
 * Anything else — offline, a 500, a timeout — is rethrown so the caller can
 * use the cached copy or show the retry screen rather than silently pretend
 * the collection is empty.
 */
export async function readOrFallback<T>(
  name: string,
  run: () => Promise<T>,
  fallback: T,
  onBlocked?: (name: string, err: unknown) => void,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    onBlocked?.(name, err);
    return fallback;
  }
}

/**
 * One line per blocked collection, for the store to surface. Kept here so the
 * wording lives beside the rule that produces it.
 */
export function blockedCollectionNotice(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const list = names.join(', ');
  return `Your database rules block ${list}. Everything else loaded normally — deploy the current firestore.rules to see ${names.length === 1 ? 'it' : 'them'}.`;
}
