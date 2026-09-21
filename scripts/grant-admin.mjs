#!/usr/bin/env node
/**
 * Grant (or remove) the platform-admin role on an existing Firebase Auth
 * account.
 *
 * The /admin console checks the `sfRole: 'platform-admin'` custom claim on
 * the signed-in user's ID token. Seeding the whole demo org just to let one
 * operator in is overkill — this script is the supported way to promote your
 * own account.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... \
 *   FIREBASE_CLIENT_EMAIL=... \
 *   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
 *   node scripts/grant-admin.mjs you@example.com
 *
 *   node scripts/grant-admin.mjs --remove you@example.com   # revoke
 *
 * Env:
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *       Service-account credentials — same contract as seed-b2b.mjs.
 *       The repo's .env is loaded automatically (real env wins), and the
 *       app-side FIREBASE_ADMIN_* names (or one FIREBASE_ADMIN_SERVICE_ACCOUNT
 *       JSON blob) are accepted too. NEVER prefix these with NEXT_PUBLIC_.
 *
 * Claims are additive: unrelated custom claims on the account are preserved.
 *
 * After granting, the user must sign out and back in — claims are minted into
 * the ID token at sign-in, so the token they already hold still says member.
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { scriptCreds } from './lib/load-env.mjs';

// Reads the environment *and* the repo .env (loaded automatically); accepts
// the FIREBASE_ADMIN_* names and a FIREBASE_ADMIN_SERVICE_ACCOUNT blob too.
const { projectId, clientEmail, privateKey } = scriptCreds();

if (!projectId) {
  console.error('✖ Missing FIREBASE_PROJECT_ID. See scripts/README.md for required env vars.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const remove = argv.includes('--remove');
const email = argv.find((a) => !a.startsWith('--'))?.trim();

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Usage: node scripts/grant-admin.mjs [--remove] <email>');
  process.exit(1);
}

const app = initializeApp({
  credential:
    privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
});
const auth = getAuth(app);

async function main() {
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(
      `✖ No Firebase Auth user with email ${email}. Create the account first ` +
        '(Firebase Console → Authentication → Users), or run seed:b2b to stand up the demo org.',
    );
    process.exit(1);
  }

  const claims = { ...(user.customClaims ?? {}) };
  if (remove) delete claims.sfRole;
  else claims.sfRole = 'platform-admin';
  await auth.setCustomUserClaims(user.uid, claims);

  console.log(`✔ ${email} — sfRole: ${remove ? 'removed' : 'platform-admin'}`);
  console.log('  Sign out and back in to pick the claim up immediately.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✖ Grant failed:', err.message || err);
    process.exit(1);
  });
