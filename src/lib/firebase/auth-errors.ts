/**
 * Re-exported from `@smartfit/core`.
 *
 * The messages and the Firebase error-code mapping are shared with the native
 * app, which hits the same failure modes (unauthorised domain, bad API key,
 * weak password) and must describe them identically.
 */
export {
  AUTH_UNAVAILABLE,
  AUTH_MESSAGES,
  errorCode,
  firebaseUnavailableMessage,
  friendlyAuthError,
  isSilentResetMiss,
} from '@smartfit/core';
