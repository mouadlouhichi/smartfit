import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTH_MESSAGES,
  errorCode,
  friendlyAuthError,
  isSilentResetMiss,
} from '../src/lib/firebase/auth-errors.ts';

/** Firebase throws plain objects carrying a `code`, not Error subclasses. */
function fbError(code: string, message = '') {
  return Object.assign(new Error(message || code), { code });
}

test('a blocked sign-in domain names the console setting to change', () => {
  const msg = friendlyAuthError(fbError('auth/unauthorized-domain'));
  assert.equal(msg, AUTH_MESSAGES.unauthorizedDomain);
  assert.match(msg, /Authorized domains/);
  assert.notEqual(msg, AUTH_MESSAGES.generic);
});

test('an invalid API key points at the environment variables', () => {
  for (const code of ['auth/invalid-api-key', 'auth/api-key-not-valid']) {
    assert.equal(friendlyAuthError(fbError(code)), AUTH_MESSAGES.invalidApiKey);
  }
});

test('permission failures reported only in the message still resolve', () => {
  // Some SDK builds surface these with a generic or absent code.
  assert.equal(
    friendlyAuthError(new Error('Firebase: Error (auth/unauthorized-domain).')),
    AUTH_MESSAGES.unauthorizedDomain,
  );
  assert.equal(
    friendlyAuthError(new Error('Requests from referer https://x.dev are blocked. API key ...')),
    AUTH_MESSAGES.apiKeyReferrerBlocked,
  );
});

test('wrong-password, unknown-user and invalid-credential are indistinguishable', () => {
  // Collapsing these is deliberate: differing copy tells an attacker which
  // addresses are registered.
  const msgs = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].map((c) =>
    friendlyAuthError(fbError(c)),
  );
  assert.deepEqual(new Set(msgs), new Set([AUTH_MESSAGES.invalidCredentials]));
});

test('the common recoverable cases each get their own message', () => {
  const cases: Array<[string, string]> = [
    ['auth/email-already-in-use', AUTH_MESSAGES.emailInUse],
    ['auth/weak-password', AUTH_MESSAGES.weakPassword],
    ['auth/invalid-email', AUTH_MESSAGES.invalidEmail],
    ['auth/popup-blocked', AUTH_MESSAGES.popupBlocked],
    ['auth/popup-closed-by-user', AUTH_MESSAGES.cancelled],
    ['auth/cancelled-popup-request', AUTH_MESSAGES.cancelled],
    ['auth/network-request-failed', AUTH_MESSAGES.network],
    ['auth/operation-not-allowed', AUTH_MESSAGES.methodDisabled],
    ['auth/too-many-requests', AUTH_MESSAGES.tooManyAttempts],
    ['auth/requires-recent-login', AUTH_MESSAGES.requiresRecentLogin],
  ];
  for (const [code, expected] of cases) {
    assert.equal(friendlyAuthError(fbError(code)), expected, code);
  }
});

test('unknown and malformed throws fall back without crashing', () => {
  for (const value of [null, undefined, 0, '', {}, [], new Error('boom'), fbError('auth/nope')]) {
    assert.equal(friendlyAuthError(value), AUTH_MESSAGES.generic);
  }
});

test('errorCode tolerates anything thrown', () => {
  assert.equal(errorCode(fbError('auth/x')), 'auth/x');
  assert.equal(errorCode(null), '');
  assert.equal(errorCode('a string'), '');
  assert.equal(errorCode({ code: 42 }), '42');
});

test('a reset for an unknown address is treated as success, not as a bad password', () => {
  assert.equal(isSilentResetMiss(fbError('auth/user-not-found')), true);
  assert.equal(isSilentResetMiss(fbError('auth/invalid-credential')), true);
  // Real failures must still surface.
  assert.equal(isSilentResetMiss(fbError('auth/network-request-failed')), false);
  assert.equal(isSilentResetMiss(fbError('auth/too-many-requests')), false);
  assert.equal(isSilentResetMiss(null), false);
});
