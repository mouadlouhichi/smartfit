import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingAccountState } from '../src/lib/landing-session';

const guest = {
  initializing: false,
  signedIn: false,
  returningLocal: false,
  memberReady: true,
  onboardingDone: false,
  resolvedHome: null,
};

test('landing offers sign-in only after resolving a signed-out session', () => {
  assert.equal(landingAccountState(guest).href, '/login');
  const loading = landingAccountState({ ...guest, initializing: true });
  assert.equal(loading.pending, true);
  assert.equal(loading.href, null);
  assert.notEqual(loading.label, 'Sign in');
});

test('signed-in visitors never get a login link while their role or member profile loads', () => {
  for (const args of [
    { ...guest, signedIn: true, resolvedHome: undefined },
    { ...guest, signedIn: true, memberReady: false },
    { ...guest, signedIn: true, initializing: true },
  ]) {
    const result = landingAccountState(args);
    assert.equal(result.authenticated, true);
    assert.equal(result.pending, true);
    assert.equal(result.href, null);
    assert.notEqual(result.label, 'Sign in');
  }
});

test('landing uses dedicated admin and gym console homes without member onboarding', () => {
  for (const [home, label] of [
    ['/admin', 'Open admin'],
    ['/g/zone-fight/console', 'Open gym console'],
  ]) {
    const result = landingAccountState({
      ...guest,
      signedIn: true,
      memberReady: false,
      resolvedHome: home,
    });
    assert.equal(result.href, home);
    assert.equal(result.label, label);
  }
});

test('members and failed lookups fall back to setup or the member dashboard, not login', () => {
  assert.equal(landingAccountState({ ...guest, signedIn: true }).href, '/onboarding');
  assert.equal(
    landingAccountState({ ...guest, signedIn: true, onboardingDone: true }).href,
    '/dashboard',
  );
  for (const resolvedHome of [
    'https://evil.test',
    '//evil.test',
    '/login',
    '/g/a/console?next=bad',
  ]) {
    assert.equal(
      landingAccountState({ ...guest, signedIn: true, resolvedHome }).href,
      '/onboarding',
    );
  }
});

test('sign-out discards a previous operator destination; local returning users can continue', () => {
  assert.equal(landingAccountState({ ...guest, resolvedHome: '/admin' }).href, '/login');
  const local = landingAccountState({ ...guest, returningLocal: true, onboardingDone: true });
  assert.equal(local.href, '/dashboard');
  assert.equal(local.label, 'Open dashboard');
});
