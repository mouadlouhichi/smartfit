/** Real SDKs + official Auth/Firestore emulators; never real credentials/projects.
 * Run pnpm test:integration. No Auth/Admin mocks and no token refresh between role changes.
 */
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeApp as adminApp,
  deleteApp as deleteAdminApp,
  type App,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import {
  getFirestore as clientFirestore,
  connectFirestoreEmulator,
  getDocFromServer,
  doc,
  onSnapshot,
  updateDoc,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { requireLocalEmulator } from '../../scripts/lib/team-preflight';
import * as team from '../../src/app/api/tenant/team/route';
import * as coaching from '../../src/app/api/coaching/route';

const PROJECT = 'demo-smartfit-integration';
// These checks run before initializing any Admin service or performing any write.
const firestoreHost = requireLocalEmulator(process.env.FIRESTORE_EMULATOR_HOST);
const authHost = requireLocalEmulator(process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)
  throw new Error('Refusing an unexpected emulator project.');
const gymPath = 'gyms/integration-gym';
let admin: App, rules: RulesTestEnvironment;
const clients: { app: FirebaseApp; auth: Auth; db: Firestore; token: string; uid: string }[] = [];
let ownerToken: string, targetToken: string;
let target: Firestore, owner: Firestore;
const membership = (uid: string, role: string) => ({
  uid,
  role,
  status: 'active',
  joinedAt: Date.now(),
  checkins: 0,
});
const change = (token: string, role: string, expectedRole: string, uid = 'target') =>
  team.POST(
    new Request('http://smartfit.test/api/tenant/team', {
      method: 'POST',
      headers: {
        host: 'smartfit.test',
        origin: 'http://smartfit.test',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        gym: 'integration-gym',
        uid,
        role,
        expectedRole,
        reason: 'Emulator authorization regression test',
      }),
    }),
  );
const permissionDenied = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'permission-denied';

before(
  async () => {
    const url = new URL(`http://${firestoreHost}`);
    rules = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: {
        host: url.hostname.replace(/^\[|\]$/g, ''),
        port: Number(url.port),
        rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      },
    });
    admin = adminApp({ projectId: PROJECT });
    for (const uid of ['owner', 'target', 'other', 'platform']) {
      const email = `${uid}@smartfit.example`,
        password = 'Emulator-only-password-234';
      await adminAuth(admin).createUser({ uid, email, password });
      if (uid === 'target')
        await adminAuth(admin).setCustomUserClaims(uid, { sfRole: 'gym-owner' }); // ignored tenant claim
      if (uid === 'platform')
        await adminAuth(admin).setCustomUserClaims(uid, { sfRole: 'platform-admin' });
      const app = initializeApp(
        { projectId: PROJECT, apiKey: 'emulator-key', appId: 'emulator-app' },
        uid,
      );
      const auth = getAuth(app);
      connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
      const db = clientFirestore(app);
      connectFirestoreEmulator(db, url.hostname.replace(/^\[|\]$/g, ''), Number(url.port));
      const user = await signInWithEmailAndPassword(auth, email, password);
      clients.push({ app, auth, db, uid, token: await user.user.getIdToken() });
    }
    ({ db: owner, token: ownerToken } = clients.find((c) => c.uid === 'owner')!);
    ({ db: target, token: targetToken } = clients.find((c) => c.uid === 'target')!);
  },
  { timeout: 60000 },
);

beforeEach(async () => {
  await rules.clearFirestore();
  const db = getFirestore(admin),
    batch = db.batch();
  batch.set(db.doc(gymPath), {
    slug: 'integration-gym',
    name: 'Integration gym',
    status: 'active',
    ownerUid: 'owner',
    tenantPlanId: 'starter',
    createdAt: Date.now(),
  });
  for (const [uid, role] of [
    ['owner', 'owner'],
    ['target', 'member'],
    ['other', 'member'],
  ])
    batch.set(db.doc(`${gymPath}/members/${uid}`), membership(uid, role));
  await batch.commit();
});
after(async () => {
  await Promise.all(
    clients.map(async (client) => {
      await terminate(client.db);
      await deleteApp(client.app);
    }),
  );
  if (rules) await rules.cleanup();
  if (admin) await deleteAdminApp(admin);
});

/** Wait for a committed snapshot, not an optimistic local/cache role. */
function observeRole(db: Firestore, role: string) {
  let stop = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => {
      stop();
      reject(new Error(`No committed ${role} snapshot received.`));
    }, 15000);
    stop = onSnapshot(
      doc(db, `${gymPath}/members/target`),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          !snapshot.metadata.fromCache &&
          !snapshot.metadata.hasPendingWrites &&
          snapshot.data()?.role === role
        ) {
          clearTimeout(timer);
          stop();
          resolve();
        }
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
      stop();
    },
  };
}

test(
  'same token gains and loses roster access; connected membership snapshots follow the change',
  { timeout: 60000 },
  async () => {
    const privateRow = doc(target, `${gymPath}/members/other`);
    await assert.rejects(getDocFromServer(privateRow), permissionDenied);
    await assert.rejects(
      updateDoc(doc(owner, `${gymPath}/members/target`), { role: 'staff' }),
      permissionDenied,
    );
    for (const [role, expected] of [
      ['staff', 'member'],
      ['member', 'staff'],
    ]) {
      const observed = observeRole(target, role);
      try {
        const response = await change(ownerToken, role, expected);
        assert.equal(response.status, 200, await response.text());
        await observed.promise;
      } finally {
        observed.cancel();
      }
      if (role === 'staff') assert.equal((await getDocFromServer(privateRow)).exists(), true);
      else await assert.rejects(getDocFromServer(privateRow), permissionDenied);
      assert.equal(
        await clients.find((c) => c.uid === 'target')!.auth.currentUser!.getIdToken(),
        targetToken,
      );
    }
    const audits = await getFirestore(admin).collection(`${gymPath}/audit`).get();
    assert.equal(audits.size, 2);
    assert.deepEqual(audits.docs.map((d) => d.get('meta.previousRole')).sort(), [
      'member',
      'staff',
    ]);
    assert.ok(
      audits.docs.every(
        (d) => d.get('actorUid') === 'owner' && d.get('action') === 'staff:role:change',
      ),
    );
  },
);

test(
  'competing confirmed role changes commit exactly one role and one audit',
  { timeout: 60000 },
  async () => {
    const results = await Promise.all([
      change(ownerToken, 'staff', 'member'),
      change(ownerToken, 'trainer', 'member'),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const db = getFirestore(admin),
      row = await db.doc(`${gymPath}/members/target`).get();
    const audit = await db.collection(`${gymPath}/audit`).get();
    assert.equal(audit.size, 1);
    assert.equal(audit.docs[0].get('meta.role'), row.get('role'));
    assert.equal(audit.docs[0].get('meta.previousRole'), 'member');
  },
);

test(
  'frozen owner and frozen/expired target grants fail with the original tokens',
  { timeout: 60000 },
  async () => {
    const db = getFirestore(admin);
    await db.doc(`${gymPath}/members/owner`).update({ status: 'frozen' });
    assert.equal((await change(ownerToken, 'staff', 'member')).status, 403);
    await db.doc(`${gymPath}/members/owner`).update({ status: 'active' });
    await db.doc(`${gymPath}/members/target`).update({ expiresAt: 1 });
    assert.equal((await change(ownerToken, 'staff', 'member')).status, 409);
    await db
      .doc(`${gymPath}/members/target`)
      .set({ ...membership('target', 'staff'), status: 'frozen' });
    await assert.rejects(
      getDocFromServer(doc(target, `${gymPath}/members/other`)),
      permissionDenied,
    );
    const coachingResponse = await coaching.GET(
      new Request('http://smartfit.test/api/coaching?gym=integration-gym', {
        headers: { authorization: `Bearer ${targetToken}` },
      }),
    );
    assert.equal(coachingResponse.status, 403);
    assert.equal((await db.collection(`${gymPath}/audit`).get()).size, 0);
  },
);

test(
  'assignment and deletion locks prevent partial role/audit commits',
  { timeout: 60000 },
  async () => {
    const db = getFirestore(admin);
    await db.doc(`${gymPath}/coaching/target`).set({ memberUid: 'target', trainerUid: 'other' });
    assert.equal((await change(ownerToken, 'staff', 'member')).status, 409);
    await db.doc(`${gymPath}/coaching/target`).delete();
    await db.doc('accountDeletionJobs/target').set({ status: 'pending' });
    assert.equal((await change(ownerToken, 'staff', 'member')).status, 409);
    assert.equal((await db.doc(`${gymPath}/members/target`).get()).get('role'), 'member');
    assert.equal((await db.collection(`${gymPath}/audit`).get()).size, 0);
  },
);

test(
  'fresh platform claims are checked even when a previously privileged token is replayed',
  { timeout: 60000 },
  async () => {
    const token = clients.find((c) => c.uid === 'platform')!.token;
    await adminAuth(admin).setCustomUserClaims('platform', {});
    assert.equal((await change(token, 'staff', 'member')).status, 403);
    assert.equal((await getFirestore(admin).collection(`${gymPath}/audit`).get()).size, 0);
  },
);
