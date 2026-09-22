import {
  can,
  canAccessTicket,
  FeatureError,
  textValue,
  ticketTransition,
  TICKET_STATES,
  validateTicket,
  type SupportTicket,
  type TicketState,
} from '@smartfit/core';
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
    const actor = await featureUser(req);
    const staff = can(actor.role, 'support:manage');
    const col = actor.services.db.collection('platform').doc('support').collection('entries');
    const result = await (staff ? col : col.where('ownerUid', '==', actor.uid))
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();
    return {
      role: actor.role,
      uid: actor.uid,
      items: result.docs
        .map((d) => ({ ...d.data(), id: d.id }) as SupportTicket)
        .sort((a, b) => b.updatedAt - a.updatedAt),
      limit: 100,
    };
  });
}
export async function POST(req: Request) {
  return featureResponse(async () => {
    const actor = await featureUser(req);
    const body = await featureBody(req);
    const staff = can(actor.role, 'support:manage');
    const col = actor.services.db.collection('platform').doc('support').collection('entries');
    if (body.action === 'create') {
      const input = validateTicket(body);
      const ref = col.doc();
      const now = Date.now();
      const item: SupportTicket = {
        id: ref.id,
        ownerUid: actor.uid,
        category: input.category,
        subject: input.subject,
        status: 'open',
        messages: [
          {
            id: crypto.randomUUID(),
            authorUid: actor.uid,
            staff: false,
            body: input.message,
            at: now,
          },
        ],
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      // A per-account transaction bounds rapid ticket creation across instances.
      await actor.services.db.runTransaction(async (tx) => {
        const throttle = actor.services.db.doc(`users/${actor.uid}/serviceLimits/support`);
        const prev = await tx.get(throttle);
        await activeFeatureAccounts(actor, [actor.uid], tx);
        if (now - (prev.data()?.lastCreatedAt ?? 0) < 30000)
          throw new FeatureError('Please wait 30 seconds before opening another ticket.', 429);
        tx.set(throttle, { lastCreatedAt: now });
        tx.create(ref, item);
      });
      return { item };
    }
    const ref = col.doc(recordId(body.id));
    const item = await actor.services.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new FeatureError('Ticket not found.', 404);
      const ticket = snap.data() as SupportTicket;
      await activeFeatureAccounts(actor, [actor.uid, ticket.ownerUid], tx);
      if (!canAccessTicket(actor.uid, ticket.ownerUid, actor.role))
        throw new FeatureError('Ticket not found.', 404);
      if (ticket.version !== body.version)
        throw new FeatureError('This ticket has new activity. Reload before replying.', 409);
      let next = { ...ticket, version: ticket.version + 1, updatedAt: Date.now() };
      if (body.action === 'reply') {
        if (ticket.status === 'closed')
          throw new FeatureError('Reopen this ticket before replying.');
        if (ticket.messages.length >= 100)
          throw new FeatureError('This conversation is full. Please open a follow-up ticket.');
        const message = textValue(body.message, 'Reply', 1, 2000);
        next = {
          ...next,
          status: staff ? 'waiting-for-user' : 'open',
          messages: [
            ...ticket.messages,
            { id: crypto.randomUUID(), authorUid: actor.uid, staff, body: message, at: Date.now() },
          ],
        };
      } else if (body.action === 'status') {
        if (
          !TICKET_STATES.includes(body.status as TicketState) ||
          !ticketTransition(ticket.status, body.status as TicketState, staff)
        )
          throw new FeatureError('That status transition is not allowed.', 403);
        next.status = body.status as TicketState;
      } else throw new FeatureError('Unknown ticket action.');
      tx.set(ref, next);
      if (staff)
        tx.create(
          actor.services.db.collection('platform').doc('audit').collection('entries').doc(),
          {
            actorUid: actor.uid,
            action: `support:${body.action}`,
            target: ref.id,
            at: Date.now(),
            meta: { status: next.status },
          },
        );
      return next;
    });
    return { item };
  });
}
