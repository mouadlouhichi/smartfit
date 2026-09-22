import {
  activeMembership,
  canReadCoaching,
  canWriteCoaching,
  coachingRole,
  FeatureError,
  isValidSlug,
  textValue,
  validateContent,
  type CoachingAssignment,
  type GymMembership,
  type GymTenant,
} from '@smartfit/core';
import {
  activeFeatureAccounts,
  featureBody,
  featureResponse,
  featureUser,
  recordId,
  type FeatureUser,
} from '@/lib/feature-server';
import { changeTeamRole } from '@/lib/team-server';
import type { Transaction } from 'firebase-admin/firestore';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function slugValue(value: unknown) {
  if (typeof value !== 'string' || !isValidSlug(value)) throw new FeatureError('Invalid gym.');
  return value;
}
async function context(actor: FeatureUser, slug: string, tx?: Transaction) {
  const gymRef = actor.services.db.doc(`gyms/${slug}`);
  const memberRef = gymRef.collection('members').doc(actor.uid);
  const [gymSnap, memberSnap] = await Promise.all([
    tx ? tx.get(gymRef) : gymRef.get(),
    tx ? tx.get(memberRef) : memberRef.get(),
  ]);
  if (!gymSnap.exists) throw new FeatureError('Gym not found.', 404);
  const gym = gymSnap.data() as GymTenant;
  if (!['active', 'trial', 'past_due'].includes(gym.status))
    throw new FeatureError('This gym is not currently available.', 403);
  const member = memberSnap.exists ? (memberSnap.data() as GymMembership) : null;
  const role = coachingRole(actor.uid, actor.role, gym, member);
  if (!role) throw new FeatureError('An active gym membership is required.', 403);
  return { role, gymRef };
}
export async function GET(req: Request) {
  return featureResponse(async () => {
    const actor = await featureUser(req);
    const slug = slugValue(new URL(req.url).searchParams.get('gym'));
    const { role, gymRef } = await context(actor, slug);
    const operator = ['gym-owner', 'gym-staff', 'platform-admin'].includes(role);
    const col = gymRef.collection('coaching');
    const [records, roster] = await Promise.all([
      (operator
        ? col
        : col.where(role === 'gym-trainer' ? 'trainerUid' : 'memberUid', '==', actor.uid)
      )
        .limit(100)
        .get(),
      operator ? gymRef.collection('members').limit(500).get() : null,
    ]);
    return {
      role,
      uid: actor.uid,
      items: records.docs.map((d) => ({ ...d.data(), id: d.id }) as CoachingAssignment),
      roster:
        roster?.docs.map((d) => {
          const m = d.data() as GymMembership;
          return {
            uid: d.id,
            role: m.role,
            displayName: m.displayName ?? 'Member',
            active: activeMembership(m),
          };
        }) ?? [],
    };
  });
}
export async function POST(req: Request) {
  return featureResponse(async () => {
    const actor = await featureUser(req);
    const body = await featureBody(req);
    if (body.action === 'role') return changeTeamRole(actor, body);
    const slug = slugValue(body.gym);
    return actor.services.db.runTransaction(async (tx) => {
      const { role, gymRef } = await context(actor, slug, tx);
      const owner = role === 'gym-owner' || role === 'platform-admin';
      if (body.action === 'assign' && !owner)
        throw new FeatureError('Only the gym owner can assign trainers.', 403);
      const ref = gymRef.collection('coaching').doc(recordId(body.memberUid));
      const snapshot = await tx.get(ref);
      const previous = snapshot.exists ? (snapshot.data() as CoachingAssignment) : null;
      if (previous && !canReadCoaching(actor.uid, role, previous))
        throw new FeatureError('Assignment not found.', 404);
      if (previous && previous.version !== body.version)
        throw new FeatureError('Assignment changed. Reload before saving.', 409);
      let item: CoachingAssignment;
      if (body.action === 'assign') {
        if (!owner) throw new FeatureError('Only the gym owner can assign trainers.', 403);
        const trainerUid = recordId(body.trainerUid);
        const [trainer, member] = await Promise.all([
          tx.get(gymRef.collection('members').doc(trainerUid)),
          tx.get(gymRef.collection('members').doc(ref.id)),
        ]);
        if (!activeMembership(trainer.data() as GymMembership) || trainer.get('role') !== 'trainer')
          throw new FeatureError('Choose an active trainer in this gym.');
        if (!activeMembership(member.data() as GymMembership) || member.get('role') !== 'member')
          throw new FeatureError('Choose an active member in this gym.');
        const now = Date.now();
        item = {
          id: ref.id,
          gymId: slug,
          memberUid: ref.id,
          trainerUid,
          memberName: member.get('displayName') ?? 'Member',
          trainerName: trainer.get('displayName') ?? 'Trainer',
          consent: 'pending',
          title: '',
          exercises: [],
          messages: [],
          version: (previous?.version ?? 0) + 1,
          createdAt: now,
          updatedAt: now,
        };
        // Reassignments start a fresh consent and conversation, never disclose old coach feedback.
      } else {
        if (!previous || !canReadCoaching(actor.uid, role, previous))
          throw new FeatureError('Assignment not found.', 404);
        item = { ...previous, version: previous.version + 1, updatedAt: Date.now() };
        if (body.action === 'remove') {
          if (!owner && actor.uid !== previous.memberUid)
            throw new FeatureError(
              'Only the owner or assigned member can remove this assignment.',
              403,
            );
          await activeFeatureAccounts(actor, [actor.uid], tx);
          tx.delete(ref);
          tx.create(gymRef.collection('audit').doc(), {
            actorUid: actor.uid,
            action: 'coaching:remove',
            target: ref.id,
            at: Date.now(),
          });
          return { ok: true };
        }
        if (body.action === 'consent') {
          if (actor.uid !== previous.memberUid)
            throw new FeatureError('Only the assigned member can give consent.', 403);
          if (!['accepted', 'declined'].includes(String(body.consent)))
            throw new FeatureError('Choose accept or decline.');
          item.consent = body.consent as 'accepted' | 'declined';
        } else {
          if (!canWriteCoaching(actor.uid, role, previous))
            throw new FeatureError(
              'An accepted assignment and participant access are required.',
              403,
            );
          if (body.action === 'feedback') {
            if (item.messages.length >= 100)
              throw new FeatureError('Conversation limit reached. Start a new assignment.');
            item.messages = [
              ...item.messages,
              {
                id: crypto.randomUUID(),
                authorUid: actor.uid,
                body: textValue(body.message, 'Feedback', 1, 2000),
                at: Date.now(),
              },
            ];
          } else if (body.action === 'routine') {
            if (actor.uid === previous.memberUid)
              throw new FeatureError(
                'Only your trainer or gym owner can prescribe a routine.',
                403,
              );
            const draft = validateContent({
              ...(body.routine as object),
              kind: 'workout',
              status: 'published',
              difficulty: 'beginner',
              durationMin: 20,
              equipment: [],
              muscles: [],
              instructions: [],
              description: '',
              safetyNotes: '',
              videoUrl: '',
              access: 'free',
            });
            item.title = draft.title;
            item.exercises = draft.exercises;
          } else throw new FeatureError('Unknown action.');
        }
      }
      await activeFeatureAccounts(actor, [actor.uid, item.memberUid, item.trainerUid], tx);
      tx.set(ref, item);
      tx.create(gymRef.collection('audit').doc(), {
        actorUid: actor.uid,
        action: `coaching:${body.action}`,
        target: ref.id,
        at: Date.now(),
      });
      return { item };
    });
  });
}
