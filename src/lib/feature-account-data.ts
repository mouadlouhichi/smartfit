import 'server-only';
import type { Firestore } from 'firebase-admin/firestore';
/** Server-only supplementary account records, scoped by immutable participant IDs. */
export async function featureAccountRecords(db: Firestore, uid: string) {
  const [tickets, memberAssignments, trainerAssignments] = await Promise.all([
    db
      .collection('platform')
      .doc('support')
      .collection('entries')
      .where('ownerUid', '==', uid)
      .get(),
    db.collectionGroup('coaching').where('memberUid', '==', uid).get(),
    db.collectionGroup('coaching').where('trainerUid', '==', uid).get(),
  ]);
  const assignments = [
    ...new Map(
      [...memberAssignments.docs, ...trainerAssignments.docs]
        .filter((d) => /^gyms\/[^/]+\/coaching\/[^/]+$/.test(d.ref.path))
        .map((d) => [d.ref.path, d]),
    ).values(),
  ];
  return { tickets: tickets.docs, assignments };
}
export async function deleteFeatureAccountData(db: Firestore, uid: string) {
  const records = await featureAccountRecords(db, uid);
  const docs = [...records.tickets, ...records.assignments];
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
}
