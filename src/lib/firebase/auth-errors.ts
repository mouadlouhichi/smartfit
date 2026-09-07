/**
 * Firebase Auth error → human message.
 *
 * Deliberately dependency-free (no React, no firebase imports) so it can be
 * unit-tested under plain Node, the same way `write-queue.ts` is.
 *
 * The important cases here are the *permission and deployment* failures.
 * A misconfigured authorised-domain list or API key referrer restriction is
 * by far the most common way sign-in breaks on a preview or staging URL, and
 * those cannot be fixed by the person clicking the button — the message has
 * to name the console setting, otherwise "Something went wrong. Please try
 * again." sends them into a retry loop that can never succeed.
 */

export const AUTH_MESSAGES = {
  unauthorizedDomain:
    'This domain is not authorised for sign-in. Add it under Firebase → Authentication → Settings → Authorized domains.',
  invalidApiKey:
    'The Firebase API key for this deployment is invalid. Check the NEXT_PUBLIC_FIREBASE_* environment variables.',
  apiKeyReferrerBlocked:
    'Firebase rejected this domain for the API key. Allow it in the Google Cloud console under API key → HTTP referrers.',
  invalidCredentials: 'Incorrect email or password.',
  emailInUse: 'An account already exists with that email. Try signing in.',
  weakPassword: 'Password should be at least 6 characters.',
  invalidEmail: 'Please enter a valid email address.',
  cancelled: 'Sign-in cancelled.',
  popupBlocked: 'Pop-up was blocked — allow pop-ups for this site and try again.',
  network: 'Network error — check your connection and try again.',
  methodDisabled: 'That sign-in method is not enabled in this Firebase project.',
  tooManyAttempts: 'Too many attempts — please wait a moment and try again.',
  requiresRecentLogin: 'For your security, please sign in again before deleting your account.',
  generic: 'Something went wrong. Please try again.',
} as const;

/** Error codes that mean "the password reset target does not exist". */
const RESET_MISS_CODES = new Set(['auth/user-not-found', 'auth/invalid-credential']);

/** Read a Firebase-style `.code` off an unknown thrown value. */
export function errorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code ?? '')
    : '';
}

/**
 * True when a failed password reset should be reported to the user as success.
 * Confirming that an address is unknown both leaks which emails are registered
 * and, because the code is shared with sign-in, would surface as "Incorrect
 * email or password." on a form that has no password field.
 */
export function isSilentResetMiss(err: unknown): boolean {
  return RESET_MISS_CODES.has(errorCode(err));
}

export function friendlyAuthError(err: unknown): string {
  const code = errorCode(err);
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return AUTH_MESSAGES.unauthorizedDomain;
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return AUTH_MESSAGES.invalidApiKey;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return AUTH_MESSAGES.invalidCredentials;
    case 'auth/email-already-in-use':
      return AUTH_MESSAGES.emailInUse;
    case 'auth/weak-password':
      return AUTH_MESSAGES.weakPassword;
    case 'auth/invalid-email':
      return AUTH_MESSAGES.invalidEmail;
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return AUTH_MESSAGES.cancelled;
    case 'auth/popup-blocked':
      return AUTH_MESSAGES.popupBlocked;
    case 'auth/network-request-failed':
      return AUTH_MESSAGES.network;
    case 'auth/operation-not-allowed':
      return AUTH_MESSAGES.methodDisabled;
    case 'auth/too-many-requests':
      return AUTH_MESSAGES.tooManyAttempts;
    case 'auth/requires-recent-login':
      return AUTH_MESSAGES.requiresRecentLogin;
    default:
      break;
  }

  // Some SDK builds report these only in the message, with a generic or absent
  // code, so match the text before falling back to the useless generic.
  if (/unauthorized[- ]domain/i.test(raw)) return AUTH_MESSAGES.unauthorizedDomain;
  if (/api[- ]key/i.test(raw) && /(referer|referrer|blocked|not valid|invalid)/i.test(raw))
    return AUTH_MESSAGES.apiKeyReferrerBlocked;
  return AUTH_MESSAGES.generic;
}
