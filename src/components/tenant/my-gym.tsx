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
import { daysUntilExpiry, gymStatusLabel, isGymLive } from '@smartfit/core';
import { formatMoney, useTenant } from '@/lib/tenant-context';
import type { GymSlot } from '@/lib/firebase/tenant-repo';
import { useAuth } from '@/lib/firebase/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { useStore } from '@/lib/store-context';
import { computeGymShareAggregates } from '@/lib/gym-share';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { statusTone } from '@/components/tenant/console';

/** The interface language as a tag `Intl` understands — never the device's. */
function intl(locale: string): string {
  return locale === 'fr' ? 'fr-FR' : 'en-GB';
}

function fmtDate(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(intl(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function fmtDateTime(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(intl(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtTime(ms: number, locale: string): string {
  return new Date(ms).toLocaleTimeString(intl(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const tenant = useTenant();
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const busy = tenant.mutating !== null;

  const mine = tenant.myBookings.find(
    (b) => b.slotId === slot.id && (b.status === 'booked' || b.status === 'waitlist'),
  );
  const left = Math.max(0, (slot.capacity ?? 0) - (slot.booked ?? 0));

  if (slot.cancelled || slot.startsAt < Date.now()) return null;

  if (tenant.mode === 'cloud' && !user) {
    return (
      <Button asChild size="sm" variant="outline">
        <a href={`/login?gym=${tenant.slug}`}>{t('gym.member.signInToBook')}</a>
      </Button>
    );
  }

  // No identity to attribute a booking to (the demo platform-admin persona).
  if (!tenant.viewerUid || !tenant.can('booking:create:self')) return null;

  async function onBook() {
    const result = await tenant.bookSlot(slot.id);
    if (!result) {
      toast(tenant.mutationError ?? t('gym.member.bookError'), 'info');
      return;
    }
    if (result.status === 'waitlist') toast(t('gym.member.waitlistedToast'), 'info');
    else toast(t('gym.member.bookedToast'), 'success');
  }

  async function onJoin() {
    const ok = await tenant.joinGymAsMember();
    if (ok) toast(t('gym.member.joinedToast'), 'success');
    else toast(tenant.mutationError ?? t('gym.member.joinError'), 'info');
  }

  async function onCancel() {
    if (!mine) return;
    const ok = await tenant.cancelMyBooking(mine.id);
    if (ok) toast(t('gym.member.cancelledToast'), 'success');
    else toast(tenant.mutationError ?? t('gym.member.cancelError'), 'info');
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
          {gymStatusLabel(mine.status, t)}
        </Badge>
        {tenant.can('booking:cancel:self') && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            {mine.status === 'waitlist' ? t('gym.member.leaveWaitlist') : t('action.cancel')}
          </Button>
        )}
      </span>
    );
  }

  if (!tenant.membership) {
    return (
      <Button size="sm" variant="outline" onClick={onJoin} disabled={busy}>
        {t('gym.member.joinToBook')}
      </Button>
    );
  }

  return (
    <Button size="sm" variant={left === 0 ? 'outline' : 'default'} onClick={onBook} disabled={busy}>
      {left === 0 ? t('gym.member.joinWaitlist') : t('gym.member.book')}
    </Button>
  );
}

// ── The member section ───────────────────────────────────────────────────────

/** Join CTA for a signed-in visitor who is not (yet) a member. */
function JoinCard() {
  const tenant = useTenant();
  const { t } = useI18n();
  const toast = useToast();
  const published = tenant.plans.filter((p) => p.published !== false);
  const cheapest = published.reduce<number | null>(
    (min, p) => (min === null || p.priceMinor < min ? p.priceMinor : min),
    null,
  );

  async function onJoin() {
    const ok = await tenant.joinGymAsMember();
    if (ok) toast(t('gym.member.joinedToast'), 'success');
    else toast(tenant.mutationError ?? t('gym.member.joinError'), 'info');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t('gym.join.title', { gym: tenant.gym?.name ?? t('gym.member.thisGym') })}
        </CardTitle>
        <CardDescription>{t('gym.join.body')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {published.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {t('gym.join.plansFrom', {
              price: formatMoney(cheapest ?? published[0].priceMinor, published[0].currency),
            })}
          </p>
        )}
        <Button onClick={onJoin} disabled={tenant.mutating !== null}>
          {t('gym.join.cta', { gym: tenant.gym?.name ?? t('gym.member.theGym') })}
        </Button>
      </CardContent>
    </Card>
  );
}

function MembershipCard() {
  const tenant = useTenant();
  const { t, locale } = useI18n();
  const m = tenant.membership!;
  const plan = tenant.plans.find((p) => p.id === m.planId);
  const days = daysUntilExpiry(m.expiresAt, Date.now());
  const now = Date.now();
  const month = new Date(now).getMonth();
  const visitsThisMonth = tenant.myCheckins.filter((c) => {
    const d = new Date(c.at);
    return d.getMonth() === month && d.getFullYear() === new Date(now).getFullYear();
  }).length;
  const accent = tenant.gym?.branding?.accentColor || 'var(--volt)';

  const rows: Array<[string, string]> = [
    [t('gym.member.plan'), plan?.name ?? t('gym.status.trial')],
    [
      t('gym.member.expires'),
      days === null
        ? t('gym.member.noEndDate')
        : days >= 0
          ? t('gym.member.daysLeft', { count: days })
          : t('gym.member.lapsed', { count: -days }),
    ],
    [t('gym.member.memberSince'), new Date(m.joinedAt).toLocaleDateString(intl(locale))],
    [
      t('gym.member.checkins'),
      t('gym.member.checkinsValue', { all: m.checkins, month: visitsThisMonth }),
    ],
    [
      t('gym.member.lastVisit'),
      typeof m.lastVisitAt === 'number' ? fmtDate(m.lastVisitAt, locale) : t('gym.member.notYet'),
    ],
  ];

  return (
    <Card className="overflow-hidden" style={{ borderTop: `4px solid ${accent}` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{t('gym.member.membership')}</span>
          <Badge className={statusTone(m.status)} variant="secondary">
            {gymStatusLabel(m.status, t)}
          </Badge>
        </CardTitle>
        <CardDescription>{m.displayName ?? tenant.gym?.name}</CardDescription>
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
  const tenant = useTenant();
  const { t, locale } = useI18n();
  const toast = useToast();
  const classById = useMemo(() => new Map(tenant.classes.map((c) => [c.id, c])), [tenant.classes]);
  const slotById = useMemo(() => new Map(tenant.slots.map((s) => [s.id, s])), [tenant.slots]);
  const now = Date.now();

  const upcoming = tenant.myBookings
    .filter((b) => b.status === 'booked' || b.status === 'waitlist')
    .map((b) => ({ b, slot: slotById.get(b.slotId) }))
    .filter((x) => x.slot && x.slot.startsAt >= now)
    .sort((a, b) => a.slot!.startsAt - b.slot!.startsAt);
  const past = tenant.myBookings
    .filter((b) => b.status !== 'booked' && b.status !== 'waitlist')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="size-4" /> {t('gym.member.myClasses')}
        </CardTitle>
        <CardDescription>
          {t('gym.member.myClassesBody', { gym: tenant.gym?.name ?? t('gym.member.theGym') })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('gym.member.noBookings')}</p>
        )}
        {upcoming.map(({ b, slot }) => (
          <div
            key={b.id}
            className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
          >
            <div>
              <p className="font-medium">
                {classById.get(slot!.classId)?.name ?? t('gym.member.classFallback')}
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {fmtDateTime(slot!.startsAt, locale)} · {fmtTime(slot!.startsAt, locale)}–
                {fmtTime(slot!.endsAt, locale)}
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
                {gymStatusLabel(b.status, t)}
              </Badge>
              {tenant.can('booking:cancel:self') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await tenant.cancelMyBooking(b.id);
                    if (ok) toast(t('gym.member.cancelledToast'), 'success');
                    else toast(tenant.mutationError ?? t('gym.member.cancelError'), 'info');
                  }}
                  disabled={tenant.mutating !== null}
                >
                  <CalendarX2 className="size-3.5" /> {t('action.cancel')}
                </Button>
              )}
            </div>
          </div>
        ))}

        {past.length > 0 && (
          <div className="border-border/60 border-t pt-2">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t('gym.member.history')}
            </p>
            {past.map((b) => {
              const slot = slotById.get(b.slotId);
              return (
                <div
                  key={b.id}
                  className="text-muted-foreground flex items-center justify-between py-0.5 text-xs"
                >
                  <span>
                    {slot ? fmtDateTime(slot.startsAt, locale) : fmtDate(b.createdAt, locale)} ·{' '}
                    {classById.get(slot?.classId ?? '')?.name ?? t('gym.member.classFallback')}
                  </span>
                  <Badge variant="outline">{gymStatusLabel(b.status, t)}</Badge>
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
  const tenant = useTenant();
  const { t, locale } = useI18n();
  const visits = tenant.myCheckins.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DoorOpen className="size-4" /> {t('gym.member.visits')}
        </CardTitle>
        <CardDescription>
          {tenant.membership
            ? t('gym.member.visitsBodyCount', { count: tenant.membership.checkins })
            : t('gym.member.visitsBody')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('gym.member.noVisits')}</p>
        ) : (
          <ul className="space-y-1">
            {visits.map((v) => (
              <li
                key={v.id}
                className="text-muted-foreground flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <Clock3 className="size-3" /> {fmtDateTime(v.at, locale)}
                </span>
                <span className="text-xs">{t('gym.member.frontDesk')}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ShareCard() {
  const tenant = useTenant();
  const { t, locale } = useI18n();
  const toast = useToast();
  const { state } = useStore();
  const busy = tenant.mutating !== null;

  const aggregates = useMemo(
    () =>
      computeGymShareAggregates(
        state,
        tenant.myBookings.map((b) => b.status),
      ),
    [state, tenant.myBookings],
  );
  const shared = !!tenant.gymShare;

  async function onToggle(on: boolean) {
    const ok = on
      ? await tenant.updateGymShare({ ...aggregates, sharedAt: Date.now() })
      : await tenant.updateGymShare(null);
    if (ok) toast(on ? t('gym.share.onToast') : t('gym.share.offToast'), 'success');
    else toast(tenant.mutationError ?? t('gym.share.error'), 'info');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="size-4" /> {t('gym.share.title')}
        </CardTitle>
        <CardDescription>
          {t('gym.share.body', { gym: tenant.gym?.name ?? t('gym.member.theGym') })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label
          className="flex cursor-pointer items-center justify-between gap-3"
          htmlFor="gym-share"
        >
          <span className="text-sm font-medium">
            {shared
              ? t('gym.share.on', { gym: tenant.gym?.name ?? t('gym.member.theGym') })
              : t('gym.share.off')}
          </span>
          <Switch
            id="gym-share"
            checked={shared}
            onCheckedChange={onToggle}
            disabled={busy || !tenant.can('member:data:share')}
            aria-label={t('gym.share.aria')}
          />
        </label>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            {t('gym.share.sessions')}{' '}
            <span className="text-foreground font-medium">{aggregates.sessionsThisMonth}</span>
          </li>
          <li>
            {t('gym.share.streak')}{' '}
            <span className="text-foreground font-medium">
              {t('gym.share.streakValue', { count: aggregates.streakDays })}
            </span>
          </li>
          <li>
            {t('gym.share.attendance')}{' '}
            <span className="text-foreground font-medium">{aggregates.attendancePct}%</span>
          </li>
        </ul>
        {shared && typeof tenant.gymShare?.sharedAt === 'number' && (
          <p className="text-muted-foreground text-xs">
            {t('gym.share.lastShared', { date: fmtDate(tenant.gymShare.sharedAt, locale) })}
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
  const tenant = useTenant();
  const { user, initializing } = useAuth();

  if (tenant.mode === 'cloud' && (initializing || !user)) return null;
  if (tenant.mode === 'cloud' && !tenant.memberDataReady) return null;
  if (!tenant.gym || !isGymLive(tenant.gym.status)) return null;

  return (
    <section id="membership" className="space-y-4">
      {tenant.membership ? (
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
