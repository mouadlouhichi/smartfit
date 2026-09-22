import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentErrors } from '../scripts/lib/deployment-config.mjs';
const env = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'public-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'example',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'app',
  FIREBASE_ADMIN_PROJECT_ID: 'example',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'service@example.test',
  FIREBASE_ADMIN_PRIVATE_KEY: 'configured',
};
test('production builds require complete matching Firebase configuration', () => {
  assert.deepEqual(deploymentErrors(env), []);
  assert.ok(deploymentErrors({ NODE_ENV: 'production' }).length > 0);
  assert.ok(deploymentErrors({ ...env, FIREBASE_ADMIN_PROJECT_ID: 'different' }).length > 0);
  assert.ok(deploymentErrors({ ...env, FIREBASE_ADMIN_PRIVATE_KEY: '' }).length > 0);
});
test('intentional demos and development remain credential free', () => {
  assert.deepEqual(deploymentErrors({ NODE_ENV: 'production', SMARTFIT_DEPLOYMENT: 'demo' }), []);
  assert.deepEqual(deploymentErrors({ NODE_ENV: 'development' }), []);
});
test('service-account JSON errors and mismatched projects are rejected without echoing secrets', () => {
  assert.ok(
    deploymentErrors({ ...env, FIREBASE_ADMIN_SERVICE_ACCOUNT: 'private bad secret' }).length > 0,
  );
  assert.ok(
    !deploymentErrors({ ...env, FIREBASE_ADMIN_SERVICE_ACCOUNT: 'private bad secret' })
      .join()
      .includes('private bad secret'),
  );
  assert.ok(
    deploymentErrors({
      ...env,
      FIREBASE_ADMIN_SERVICE_ACCOUNT: JSON.stringify({
        project_id: 'other',
        client_email: 'x',
        private_key: 'secret',
      }),
    }).length > 0,
  );
  assert.deepEqual(
    deploymentErrors({
      ...env,
      FIREBASE_ADMIN_SERVICE_ACCOUNT: JSON.stringify({
        project_id: 'example',
        client_email: 'x',
        private_key: 'secret',
      }),
    }),
    [],
  );
});

test('real production rejects emulator routing, especially unsigned Auth emulator tokens', () => {
  for (const key of [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST',
  ]) {
    assert.ok(
      deploymentErrors({ ...env, [key]: '127.0.0.1:9099' }).some((error: string) =>
        error.includes(key),
      ),
    );
  }
});
