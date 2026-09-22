#!/usr/bin/env node
/**
 * Promote a personal custom gym into a real B2B tenant.
 *
 * Some SmartFit members already invented their gym with the personal
 * "custom gyms" toy (users/{uid}/customGyms — one member's private data). When
 * that person wants to run the *real* thing, this script is the bridge: it
 * provisions a tenant from their custom gym and converts its classes into
 * real class templates + scheduled occurrences.
 *
 * Nothing is silently moved (the pivot plan's §6 promise): the original
 * customGym document stays exactly where it was — it is personal data with
 * correct owner-only rules — and the tenant is a fresh copy the platform
 * owns. The member keeps their tracker; the gym gets a business.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
 *   B2B_PROMOTE_UID=<firebase uid> B2B_PROMOTE_GYM=<customGym doc id> \
 *   node scripts/promote-custom-gym.mjs
 *
 * Env:
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *       Service-account credentials (same as seed-b2b — the repo .env is
 *       loaded automatically and FIREBASE_ADMIN_* names are accepted too).
 *   B2B_PROMOTE_UID   the uid whose customGyms collection holds the gym
 *   B2B_PROMOTE_GYM   the customGym document id to promote
 *   B2B_GYM_SLUG      tenant slug / subdomain (default: slugged gym name,
 *                     errors out if taken — pass an explicit slug instead)
 *   B2B_PLAN          platform plan for the new tenant (default: starter)
 *   B2B_PROMOTE_FORCE set to "1" to allow promoting into an existing tenant
 *                     doc (merge); default refuses so a rerun cannot clobber
 *
 * Idempotent for classes and slots: document ids are derived from the custom
 * class ids, so a re-run updates in place rather than duplicating.
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { scriptCreds } from './lib/load-env.mjs';

// Reads the environment *and* the repo .env (loaded automatically — including
// the B2B_* vars below); accepts FIREBASE_ADMIN_* names too.
const { projectId, clientEmail, privateKey } = scriptCreds();

const UID = process.env.B2B_PROMOTE_UID;
const GYM_DOC_ID = process.env.B2B_PROMOTE_GYM;
const PLAN = process.env.B2B_PLAN || 'starter';
const FORCE = process.env.B2B_PROMOTE_FORCE === '1';

if (!projectId || !UID || !GYM_DOC_ID) {
  console.error(
    '✖ Need FIREBASE_PROJECT_ID (+ creds), B2B_PROMOTE_UID and B2B_PROMOTE_GYM. See the header of this file.',
  );
  process.exit(1);
}

const app = initializeApp({
  credential:
    privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
});
const auth = getAuth(app);
const db = getFirestore(app);

/** Next local occurrence of a weekday at HH:MM — the same rule the seed uses. */
function nextSlot(weekday, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d.getTime();
}

function slugify(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

async function main() {
  // ── Read the source (personal data — read-only, never modified) ──────────
  const sourceRef = db.doc(`users/${UID}/customGyms/${GYM_DOC_ID}`);
  const source = await sourceRef.get();
  if (!source.exists) {
    console.error(`✖ No custom gym "${GYM_DOC_ID}" for uid ${UID}.`);
    process.exit(1);
  }
  const gym = source.data();

  const user = await auth.getUser(UID).catch(() => null);
  if (!user) {
    console.error(`✖ No Firebase Auth account for uid ${UID} — an owner must exist first.`);
    process.exit(1);
  }

  // ── Resolve the slug ──────────────────────────────────────────────────────
  const slug = (process.env.B2B_GYM_SLUG || slugify(gym.name || '')).toLowerCase();
  if (!slug || slug.length < 2) {
    console.error('✖ Could not derive a slug from the gym name. Pass B2B_GYM_SLUG.');
    process.exit(1);
  }
  const tenantRef = db.doc(`gyms/${slug}`);
  const existing = await tenantRef.get();
  if (existing.exists && !FORCE) {
    console.error(`✖ A tenant already exists at "${slug}". Pass B2B_GYM_SLUG to choose another.`);
    process.exit(1);
  }

  // ── Provision the tenant ──────────────────────────────────────────────────
  const now = Date.now();
  await tenantRef.set(
    {
      slug,
      name: gym.name || slug,
      subdomain: slug,
      status: 'trial',
      tenantPlanId: PLAN,
      ownerUid: UID,
      createdAt: existing.exists ? (existing.data().createdAt ?? now) : now,
      updatedAt: now,
      ...(gym.description ? { branding: { description: gym.description } } : {}),
      ...(gym.location ? { location: { address: gym.location } } : {}),
    },
    { merge: true },
  );

  // The membership row is what the security rules read for 'owner' — without
  // it the gym exists but its console refuses every write.
  await db.doc(`gyms/${slug}/members/${UID}`).set(
    {
      role: 'owner',
      status: 'active',
      joinedAt: now,
      checkins: 0,
      ...(user.displayName ? { displayName: user.displayName } : {}),
      ...(user.email ? { email: user.email } : {}),
    },
    { merge: true },
  );
  console.log(`▸ Tenant gyms/${slug} provisioned (trial, ${PLAN}) — owner ${user.email}`);

  // ── Convert classes ───────────────────────────────────────────────────────
  const programs = Array.isArray(gym.programs) ? gym.programs : [];
  const classes = programs.flatMap((p) => (Array.isArray(p.classes) ? p.classes : []));
  let slots = 0;
  for (const cls of classes) {
    await db.doc(`gyms/${slug}/classes/${cls.id}`).set(
      {
        name: cls.name,
        focus: cls.focus ?? 'strength',
        intensity: cls.intensity ?? 'moderate',
        minutes: cls.minutes ?? 45,
        capacity: 16,
        ...(cls.instructor ? { instructorName: cls.instructor } : {}),
        createdAt: cls.createdAt ?? now,
      },
      { merge: true },
    );
    if (typeof cls.weekday === 'number' && typeof cls.time === 'string') {
      const startsAt = nextSlot(cls.weekday, cls.time);
      await db.doc(`gyms/${slug}/slots/slot-${cls.id}`).set(
        {
          classId: cls.id,
          startsAt,
          endsAt: startsAt + (cls.minutes ?? 45) * 60_000,
          capacity: 16,
          booked: 0,
          cancelled: false,
        },
        { merge: true },
      );
      slots++;
    }
  }
  console.log(`▸ Converted ${classes.length} classes (${slots} with a schedule → slots)`);

  console.log('\n✔ Promotion complete.\n');
  console.log(`  The original stays untouched: users/${UID}/customGyms/${GYM_DOC_ID}`);
  console.log(`  The gym is live at  /g/${slug}   (console: /g/${slug}/console)`);
  console.log('  Sign in as the owner to publish the timetable and pricing.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✖ Promotion failed:', err.message || err);
    process.exit(1);
  });
