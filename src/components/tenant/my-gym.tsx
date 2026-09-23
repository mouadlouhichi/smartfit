'use client';

/**
 * The member's side of a gym: join, membership card, book/cancel/waitlist,
 * visit history, and the opt-in progress share.
 *
 * This is the surface Phase 7 of the pivot exists for — the B2C member gets
 * gym features **on the gym's own site**, so `/dashboard/**` and the Expo app
 * stay byte-for-byte what they were. Everything here reads the same
 * capability table the rules enforce: a member can only ever touch their own
 * seat and their own share document.
 *
 * The privacy line is drawn in `@/lib/gym-share`: the *only* training data
 * that crosses the member→gym boundary is three aggregates, published by the
 * member, revocable with one tap. The share card spells out exactly what
 * those numbers are — "explicit" is the whole feature.
 */
import { useMemo } from 'react';
import { CalendarCheck, CalendarX2, Clock3, CreditCard, DoorOpen, Share2 } from 'lucide-react';
import { daysUntilExpiry, isGymLive } from '@smartfit/core';
import { formatMoney, useTenant } from '@/lib/tenant-context';
import type { GymSlot } from '@/lib/firebase/tenant-repo';
import { useAuth } from '@/lib/firebase/auth-context';
import { useStore } from '@/lib/store-context';
import { computeGymShareAggregates } from '@/lib/gym-share';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { statusTone } from '@/components/tenant/console';

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Booking actions on a timetable row ───────────────────────────────────────

/**
 * Book / cancel / waitlist for one class occurrence.
 *
 * Rendered inside the public timetable (and the class detail page), so every
 * state a visitor can be in has an honest action: signed-out → sign in;
 * not a member → join; member → book, or waitlist when full; already booked →
 * cancel. A past or cancelled slot offers nothing.
 */
export function SlotBookingActions({ slot }: { slot: GymSlot }) {
  const t = useTenant();
  const toast = useToast();
  const { user } = useAuth();
  const busy = t.mutating !== null;

  const mine = t.myBookings.find(
    (b) => b.slotId === slot.id && (b.status === 'booked' || b.status === 'waitlist'),
  );
  const left = Math.max(0, (slot.capacity ?? 0) - (slot.booked ?? 0));

  if (slot.cancelled || slot.startsAt < Date.now()) return null;

  if (t.mode === 'cloud' && !user) {
    return (
      <Button asChild size="sm" variant="outline">
        <a href={`/login?gym=${t.slug}`}>Sign in to book</a>
      </Button>
    );
  }

  // No identity to attribute a booking to (the demo platform-admin persona).
  if (!t.viewerUid || !t.can('booking:create:self')) return null;

  async function onBook() {
    const result = await t.bookSlot(slot.id);
    if (!result) {
      toast(t.mutationError ?? 'Could not book that class', 'info');
      return;
    }
    if (result.status === 'waitlist') toast('Class is full — you are on the waitlist', 'info');
    else toast('Booked — see you there', 'success');
  }

  async function onJoin() {
    const ok = await t.joinGymAsMember();
    if (ok) toast('Welcome — your trial membership is active', 'success');
    else toast(t.mutationError ?? 'Could not join', 'info');
  }

  async function onCancel() {
    if (!mine) return;
    const ok = await t.cancelMyBooking(mine.id);
    if (ok) toast('Booking cancelled', 'success');
    else toast(t.mutationError ?? 'Could not cancel', 'info');
  }

  if (mine) {
    return (
      <span className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={
            mine.status === 'waitlist'
              ? 'bg-amber-500/15 text-amber-600'
              : 'bg-emerald-500/15 text-emerald-600'
          }
        >
          {mine.status === 'waitlist' ? 'On waitlist' : 'Booked'}
        </Badge>
        {t.can('booking:cancel:self') && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            {mine.status === 'waitlist' ? 'Leave' : 'Cancel'}
          </Button>
        )}
      </span>
    );
  }

  if (!t.membership) {
    return (
      <Button size="sm" variant="outline" onClick={onJoin} disabled={busy}>
        Join to book
      </Button>
    );
  }

  return (
    <Button size="sm" variant={left === 0 ? 'outline' : 'default'} onClick={onBook} disabled={busy}>
      {left === 0 ? 'Join waitlist' : 'Book'}
    </Button>
  );
}

// ── The member section ───────────────────────────────────────────────────────

/** Join CTA for a signed-in visitor who is not (yet) a member. */
function JoinCard() {
  const t = useTenant();
  const toast = useToast();
  const published = t.plans.filter((p) => p.published !== false);
  const cheapest = published.reduce<number | null>(
    (min, p) => (min === null || p.priceMinor < min ? p.priceMinor : min),
    null,
  );

  async function onJoin() {
    const ok = await t.joinGymAsMember();
    if (ok) toast('Welcome — your trial membership is active', 'success');
    else toast(t.mutationError ?? 'Could not join', 'info');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Train at {t.gym?.name ?? 'this gym'}</CardTitle>
        <CardDescription>
          One tap and you are in on a trial membership — the front desk can move you onto a plan
          whenever you are ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {published.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Plans from {formatMoney(cheapest ?? published[0].priceMinor, published[0].currency)} —
            see the full list below.
          </p>
        )}
        <Button onClick={onJoin} disabled={t.mutating !== null}>
          Join {t.gym?.name ?? 'the gym'}
        </Button>
      </CardContent>
    </Card>
  );
}

function MembershipCard() {
  const t = useTenant();
  const m = t.membership!;
  const plan = t.plans.find((p) => p.id === m.planId);
  const days = daysUntilExpiry(m.expiresAt, Date.now());
  const now = Date.now();
  const month = new Date(now).getMonth();
  const visitsThisMonth = t.myCheckins.filter((c) => {
    const d = new Date(c.at);
    return d.getMonth() === month && d.getFullYear() === new Date(now).getFullYear();
  }).length;
  const accent = t.gym?.branding?.accentColor || 'var(--volt)';

  const rows: Array<[string, string]> = [
    ['Plan', plan?.name ?? 'Trial'],
    [
      'Expires',
      days === null
        ? 'No end date'
        : days >= 0
          ? `${days} day${days === 1 ? '' : 's'} left`
          : `Lapsed ${-days} day${days === -1 ? '' : 's'} ago`,
    ],
    ['Member since', new Date(m.joinedAt).toLocaleDateString('en-GB')],
    ['Check-ins', `${m.checkins} all time · ${visitsThisMonth} this month`],
    ['Last visit', typeof m.lastVisitAt === 'number' ? fmtDate(m.lastVisitAt) : 'Not yet'],
  ];

  return (
    <Card className="overflow-hidden" style={{ borderTop: `4px solid ${accent}` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Membership</span>
          <Badge className={statusTone(m.status)} variant="secondary">
            {m.status}
          </Badge>
        </CardTitle>
        <CardDescription>{m.displayName ?? t.gym?.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function BookingsCard() {
  const t = useTenant();
  const toast = useToast();
  const classById = useMemo(() => new Map(t.classes.map((c) => [c.id, c])), [t.classes]);
  const slotById = useMemo(() => new Map(t.slots.map((s) => [s.id, s])), [t.slots]);
  const now = Date.now();

  const upcoming = t.myBookings
    .filter((b) => b.status === 'booked' || b.status === 'waitlist')
    .map((b) => ({ b, slot: slotById.get(b.slotId) }))
    .filter((x) => x.slot && x.slot.startsAt >= now)
    .sort((a, b) => a.slot!.startsAt - b.slot!.startsAt);
  const past = t.myBookings
    .filter((b) => b.status !== 'booked' && b.status !== 'waitlist')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="size-4" /> My classes
        </CardTitle>
        <CardDescription>
          Booked with {t.gym?.name}. Cancel any time up to the class.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nothing booked yet — pick a class from the timetable below.
          </p>
        )}
        {upcoming.map(({ b, slot }) => (
          <div
            key={b.id}
            className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
          >
            <div>
              <p className="font-medium">{classById.get(slot!.classId)?.name ?? 'Class'}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {fmtDateTime(slot!.startsAt)} · {fmtTime(slot!.startsAt)}–{fmtTime(slot!.endsAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={
                  b.status === 'waitlist'
                    ? 'bg-amber-500/15 text-amber-600'
                    : 'bg-emerald-500/15 text-emerald-600'
                }
              >
                {b.status === 'waitlist' ? 'On waitlist' : 'Booked'}
              </Badge>
              {t.can('booking:cancel:self') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await t.cancelMyBooking(b.id);
                    if (ok) toast('Booking cancelled', 'success');
                    else toast(t.mutationError ?? 'Could not cancel', 'info');
                  }}
                  disabled={t.mutating !== null}
                >
                  <CalendarX2 className="size-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>
        ))}

        {past.length > 0 && (
          <div className="border-border/60 border-t pt-2">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              History
            </p>
            {past.map((b) => {
              const slot = slotById.get(b.slotId);
              return (
                <div
                  key={b.id}
                  className="text-muted-foreground flex items-center justify-between py-0.5 text-xs"
                >
                  <span>
                    {slot ? fmtDateTime(slot.startsAt) : fmtDate(b.createdAt)} ·{' '}
                    {classById.get(slot?.classId ?? '')?.name ?? 'Class'}
                  </span>
                  <Badge variant="outline">{b.status.replace('_', ' ')}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VisitHistoryCard() {
  const t = useTenant();
  const visits = t.myCheckins.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DoorOpen className="size-4" /> Visits
        </CardTitle>
        <CardDescription>
          Recorded at the door{t.membership ? ` — ${t.membership.checkins} all time` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <p className="text-muted-foreground text-sm">No visits recorded yet.</p>
        ) : (
          <ul className="space-y-1">
            {visits.map((v) => (
              <li
                key={v.id}
                className="text-muted-foreground flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <Clock3 className="size-3" /> {fmtDateTime(v.at)}
                </span>
                <span className="text-xs">front desk</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ShareCard() {
  const t = useTenant();
  const toast = useToast();
  const { state } = useStore();
  const busy = t.mutating !== null;

  const aggregates = useMemo(
    () =>
      computeGymShareAggregates(
        state,
        t.myBookings.map((b) => b.status),
      ),
    [state, t.myBookings],
  );
  const shared = !!t.gymShare;

  async function onToggle(on: boolean) {
    const ok = on
      ? await t.updateGymShare({ ...aggregates, sharedAt: Date.now() })
      : await t.updateGymShare(null);
    if (ok)
      toast(
        on ? 'Sharing on — the gym sees your three numbers' : 'Sharing off — share deleted',
        'success',
      );
    else toast(t.mutationError ?? 'Could not update sharing', 'info');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="size-4" /> Progress sharing
        </CardTitle>
        <CardDescription>
          Let {t.gym?.name ?? 'the gym'} see how your training is going — three numbers, nothing
          else. No workouts, no body data, no meals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label
          className="flex cursor-pointer items-center justify-between gap-3"
          htmlFor="gym-share"
        >
          <span className="text-sm font-medium">
            {shared ? 'Sharing with ' + (t.gym?.name ?? 'the gym') : 'Off — the gym sees nothing'}
          </span>
          <Switch
            id="gym-share"
            checked={shared}
            onCheckedChange={onToggle}
            disabled={busy || !t.can('member:data:share')}
            aria-label="Share progress aggregates with this gym"
          />
        </label>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Sessions logged this month:{' '}
            <span className="text-foreground font-medium">{aggregates.sessionsThisMonth}</span>
          </li>
          <li>
            Training streak:{' '}
            <span className="text-foreground font-medium">{aggregates.streakDays} days</span>
          </li>
          <li>
            Class attendance:{' '}
            <span className="text-foreground font-medium">{aggregates.attendancePct}%</span>
          </li>
        </ul>
        {shared && typeof t.gymShare?.sharedAt === 'number' && (
          <p className="text-muted-foreground text-xs">
            Last shared {fmtDate(t.gymShare.sharedAt)} · turning this off deletes the share
            immediately.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The whole member section. Hidden entirely for signed-out visitors (their
 * path in is the "Sign in to book" action on each class) and while the
 * member's own data is still resolving, so a member never sees the join CTA
 * flash for their own gym.
 */
export function MyGym() {
  const t = useTenant();
  const { user, initializing } = useAuth();

  if (t.mode === 'cloud' && (initializing || !user)) return null;
  if (t.mode === 'cloud' && !t.memberDataReady) return null;
  if (!t.gym || !isGymLive(t.gym.status)) return null;

  return (
    <section id="membership" className="space-y-4">
      {t.membership ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MembershipCard />
          <BookingsCard />
          <VisitHistoryCard />
          <ShareCard />
        </div>
      ) : (
        <JoinCard />
      )}
    </section>
  );
}
