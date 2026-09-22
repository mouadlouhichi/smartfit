import { can, FeatureError, validateContent, type TrainingContent } from '@smartfit/core';
import { getAdminServices } from '@/lib/firebase/admin';
import {
  activeFeatureAccounts,
  featureBody,
  featureResponse,
  featureUser,
  recordId,
} from '@/lib/feature-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return featureResponse(async () => {
    const editorial = new URL(req.url).searchParams.get('editorial') === '1';
    const actor = editorial ? await featureUser(req) : null;
    if (actor && !can(actor.role, 'content:manage'))
      throw new FeatureError('Content editor access required.', 403);
    const db = actor?.services.db ?? getAdminServices().db;
    const col = db.collection('platform').doc('content').collection('entries');
    const result = await (editorial ? col : col.where('status', '==', 'published'))
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();
    return {
      role: actor?.role ?? 'guest',
      items: result.docs
        .map((d) => {
          const item = { ...d.data(), id: d.id } as TrainingContent;
          // Internal editor identifiers do not belong in public previews.
          return editorial ? item : { ...item, updatedBy: '' };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
      limit: 100,
    };
  });
}
export async function POST(req: Request) {
  return featureResponse(async () => {
    const actor = await featureUser(req);
    if (!can(actor.role, 'content:manage'))
      throw new FeatureError('Content editor access required.', 403);
    const body = await featureBody(req);
    const draft = validateContent(body.draft);
    const col = actor.services.db.collection('platform').doc('content').collection('entries');
    const ref = body.id ? col.doc(recordId(body.id)) : col.doc();
    const item = await actor.services.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      await activeFeatureAccounts(actor, [actor.uid], tx);
      const previous = snap.exists ? (snap.data() as TrainingContent) : null;
      if (body.id && !previous) throw new FeatureError('Content no longer exists.', 404);
      if (previous && previous.version !== body.version)
        throw new FeatureError(
          'This content changed in another session. Reload before saving.',
          409,
        );
      const now = Date.now();
      const next: TrainingContent = {
        ...draft,
        id: ref.id,
        version: (previous?.version ?? 0) + 1,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        updatedBy: actor.uid,
      };
      tx.set(ref, next);
      tx.set(ref.collection('revisions').doc(String(next.version)), next);
      const audit = actor.services.db
        .collection('platform')
        .doc('audit')
        .collection('entries')
        .doc();
      tx.set(audit, {
        actorUid: actor.uid,
        action: 'content:save',
        target: ref.id,
        at: now,
        meta: {
          version: next.version,
          status: next.status,
          previousStatus: previous?.status ?? null,
        },
      });
      return next;
    });
    return { item };
  });
}
