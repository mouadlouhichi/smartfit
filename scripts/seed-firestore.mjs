#!/usr/bin/env node
/**
 * Seed DEMO data into Cloud Firestore.
 *
 * The production app ships with NO demo data (new users land on onboarding).
 * This script is the supported way to populate a demo / staging account with
 * a realistic training history so charts, streaks and goals render.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... \
 *   FIREBASE_CLIENT_EMAIL=... \
 *   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
 *   SEED_UID=demo-user \
 *   node scripts/seed-firestore.mjs
 *
 * Env:
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *       Service-account credentials (Firebase console → Project settings →
 *       Service accounts → Generate new private key). NEVER prefix with
 *       NEXT_PUBLIC_ and never commit real values.
 *   SEED_UID   (optional) document id for the demo user; default "demo-user"
 *   SEED_EMAIL (optional) demo account email, default demo@smartfit.app
 *
 * This writes the same shape the web app reads:
 *   users/{uid}                        -> { profile }
 *   users/{uid}/categories/{id}        -> category docs
 *   users/{uid}/sessions/{id}          -> workout sessions
 *   users/{uid}/schedule/{id}          -> scheduled workouts
 *   users/{uid}/goals/{id}             -> goals
 *   users/{uid}/bodyLogs/{id}          -> body logs
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n');

const uid = process.env.SEED_UID || 'demo-user';
const email = process.env.SEED_EMAIL || 'demo@smartfit.app';

if (!projectId) {
  console.error('✖ Missing FIREBASE_PROJECT_ID (and client email / private key).');
  console.error('  See scripts/README.md for required env vars.');
  process.exit(1);
}

const app = initializeApp({
  credential:
    privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
});

const db = getFirestore(app);

// ── Demo data (mirrors @smartfit/core buildSeedState) ────────────────────
const now = Date.now();
const day = 86_400_000;

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const categories = [
  { id: 'cat-strength', name: 'Strength', icon: 'dumbbell', color: '#e05e36', builtin: true },
  { id: 'cat-cardio', name: 'Cardio', icon: 'heart-pulse', color: '#cdaca4', builtin: true },
  { id: 'cat-hiit', name: 'HIIT', icon: 'flame', color: '#8a6a58', builtin: true },
  {
    id: 'cat-mobility',
    name: 'Mobility',
    icon: 'stretch-horizontal',
    color: '#eda07e',
    builtin: true,
  },
  { id: 'cat-sports', name: 'Sports', icon: 'volleyball', color: '#2b2725', builtin: true },
];

function estCal(min, intensity) {
  const perMin = intensity === 'high' ? 11 : intensity === 'moderate' ? 8 : 5;
  return Math.round(min * perMin);
}

const templates = [
  { dow: 1, cat: 'cat-strength', title: 'Push — chest & shoulders', min: 55, int: 'high' },
  { dow: 2, cat: 'cat-strength', title: 'Pull — back & biceps', min: 50, int: 'high' },
  { dow: 3, cat: 'cat-cardio', title: 'Morning run', min: 35, int: 'moderate', dist: 5.2 },
  { dow: 4, cat: 'cat-hiit', title: 'HIIT circuits', min: 28, int: 'high' },
  { dow: 5, cat: 'cat-strength', title: 'Legs — squats & hinges', min: 60, int: 'high' },
  { dow: 6, cat: 'cat-sports', title: 'Football with friends', min: 70, int: 'moderate' },
];

// Build ~6 weeks of sessions.
const sessions = [];
for (let week = 0; week < 6; week++) {
  for (const t of templates) {
    const age = week * 7 + ((7 - t.dow + 1) % 7 || 7);
    if (age < 1) continue;
    sessions.push({
      id: `seed_ses_${week}_${t.dow}`,
      date: daysAgo(age),
      categoryId: t.cat,
      title: t.title,
      durationMin: t.min,
      intensity: t.int,
      calories: estCal(t.min, t.int),
      distanceKm: t.dist,
      exercises: [],
      createdAt: now - age * day,
    });
  }
}

const schedule = [
  {
    id: 'seed_sch_1',
    title: 'Push',
    categoryId: 'cat-strength',
    weekday: 1,
    timeOfDay: '07:30',
    durationMin: 55,
    intensity: 'high',
    active: true,
    createdAt: now,
  },
  {
    id: 'seed_sch_2',
    title: 'Pull',
    categoryId: 'cat-strength',
    weekday: 2,
    timeOfDay: '07:30',
    durationMin: 50,
    intensity: 'high',
    active: true,
    createdAt: now,
  },
  {
    id: 'seed_sch_3',
    title: 'Run',
    categoryId: 'cat-cardio',
    weekday: 3,
    timeOfDay: '06:45',
    durationMin: 35,
    intensity: 'moderate',
    active: true,
    createdAt: now,
  },
  {
    id: 'seed_sch_4',
    title: 'HIIT',
    categoryId: 'cat-hiit',
    weekday: 4,
    timeOfDay: '18:00',
    durationMin: 28,
    intensity: 'high',
    active: true,
    createdAt: now,
  },
  {
    id: 'seed_sch_5',
    title: 'Legs',
    categoryId: 'cat-strength',
    weekday: 5,
    timeOfDay: '07:30',
    durationMin: 60,
    intensity: 'high',
    active: true,
    createdAt: now,
  },
];

const goals = [
  {
    id: 'seed_goal_workouts',
    name: 'Train this week',
    metric: 'workouts',
    cadence: 'weekly',
    target: 5,
    startDate: daysAgo(6),
    createdAt: now,
  },
  {
    id: 'seed_goal_minutes',
    name: 'Active minutes',
    metric: 'minutes',
    cadence: 'weekly',
    target: 260,
    startDate: daysAgo(6),
    createdAt: now,
  },
  {
    id: 'seed_goal_distance',
    name: 'Monthly distance',
    metric: 'distance',
    cadence: 'monthly',
    target: 60,
    startDate: daysAgo(29),
    createdAt: now,
  },
];

const bodyLogs = [
  { id: 'seed_body_w0', date: daysAgo(42), unit: 'weight', value: 82.5, createdAt: now - 42 * day },
  { id: 'seed_body_w1', date: daysAgo(28), unit: 'weight', value: 81.4, createdAt: now - 28 * day },
  { id: 'seed_body_w2', date: daysAgo(14), unit: 'weight', value: 80.6, createdAt: now - 14 * day },
  { id: 'seed_body_w3', date: daysAgo(2), unit: 'weight', value: 79.9, createdAt: now - 2 * day },
];

const profile = {
  name: 'Demo Athlete',
  email,
  weightUnit: 'kg',
  distanceUnit: 'km',
  weeklyRestDays: 2,
  planId: 'upper-lower',
  onboardingDone: true,
};

async function main() {
  const userRef = db.collection('users').doc(uid);
  await userRef.set({ profile, createdAt: FieldValue.serverTimestamp(), demo: true });

  async function putAll(name, items) {
    const col = userRef.collection(name);
    const batch = db.batch();
    for (const { id, ...data } of items) {
      batch.set(col.doc(id), data);
    }
    await batch.commit();
    console.log(`  ✓ ${name}: ${items.length} docs`);
  }

  console.log(`Seeding demo user "${uid}" into project "${projectId}" …`);
  await putAll('categories', categories);
  await putAll('sessions', sessions);
  await putAll('schedule', schedule);
  await putAll('goals', goals);
  await putAll('bodyLogs', bodyLogs);
  console.log('Done. Sign in as the demo account (or set SEED_UID to an existing uid) to view it.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
