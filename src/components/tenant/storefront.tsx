'use client';

/**
 * The public storefront for one gym.
 *
 * This is the tenant's shop window and the reason the `gyms/{slug}` document is
 * readable by any signed-in user: a prospect must be able to see the gym before
 * joining it. Everything rendered here comes from that public document and the
 * published timetable — nothing from `settings/`, nothing from any member's
 * data.
 *
 * For a signed-in member the same page grows a personal section (`MyGym`):
 * membership card, bookings, visit history and the opt-in progress share. It
 * lives *here* rather than in `/dashboard` so the B2C app stays untouched —
 * the gym's site is where gym things happen.
 */
import { useMemo } from 'react';
import { Clock, MapPin, Phone, Mail, AtSign, CalendarDays, Users, Dumbbell } from 'lucide-react';
import { isGymLive, type GymTenant } from '@smartfit/core';
import { useTenant, formatMoney } from '@/lib/tenant-context';
import type { GymClass, GymSlot } from '@/lib/firebase/tenant-repo';
import { useAuth } from '@/lib/firebase/auth-context';
import { MyGym, SlotBookingActions } from '@/components/tenant/my-gym';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FOCUS_LABEL: Record<string, string> = {
  combat: 'Combat',
  hiit: 'HIIT',
  strength: 'Strength',
  cardio: 'Cardio',
  mind: 'Mind & recovery',
  aqua: 'Aqua',
};

function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(ms: number): string {
  return new Date(ms).toDateString();
}

/** Group slots into days, soonest first — the shape a timetable is read in. */
export function groupByDay(slots: GymSlot[]): { label: string; slots: GymSlot[] }[] {
  const map = new Map<string, GymSlot[]>();
  for (const slot of [...slots].sort((a, b) => a.startsAt - b.startsAt)) {
    const key = dayKey(slot.startsAt);
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }
  return [...map.entries()].map(([label, list]) => ({ label, slots: list }));
}

function NotLive({ gym }: { gym: GymTenant | null }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-xl font-bold">{gym?.name ?? 'This gym'} is not open yet</p>
      <p className="text-muted-foreground text-sm">
        {gym?.status === 'suspended'
          ? 'This gym is temporarily unavailable. Contact the gym directly for help with an existing membership.'
          : 'The page is being set up. Check back shortly.'}
      </p>
    </div>
  );
}

export function Storefront() {
  const { gym, classes, slots, plans, loading, error, slug, mode, demoRole, setDemoRole } =
    useTenant();
  const { user } = useAuth();

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const days = useMemo(() => groupByDay(slots.filter((s) => !s.cancelled).slice(0, 21)), [slots]);
  const publishedPlans = useMemo(() => plans.filter((p) => p.published !== false), [plans]);
  const accent = gym?.branding?.accentColor || '#8ad200';
  /** Where the pricing "Join" buttons lead: sign-in, or straight to the member section. */
  const joinHref = mode === 'cloud' && !user ? `/login?gym=${slug}` : `/g/${slug}#membership`;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="bg-muted h-40 animate-pulse rounded-2xl" />
        <div className="bg-muted h-24 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-bold">Could not load this gym</p>
        <p className="text-muted-foreground mt-2 text-sm">{error}</p>
      </div>
    );
  }

  if (!gym || !isGymLive(gym.status)) return <NotLive gym={gym} />;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pb-24 sm:p-6">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-3xl p-8 text-black sm:p-12"
        style={{ backgroundColor: accent }}
      >
        <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">{slug}.smartfit</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{gym.name}</h1>
        {gym.branding?.tagline && (
          <p className="mt-3 max-w-xl text-lg font-medium opacity-80">{gym.branding.tagline}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary" className="bg-black text-white hover:bg-black/85">
            <a href={`/g/${slug}/#pricing`}>See pricing</a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-black/30 bg-transparent hover:bg-black/10"
          >
            <a href={`/g/${slug}/#timetable`}>View timetable</a>
          </Button>
        </div>
      </header>

      {mode === 'demo' && (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-xl border border-dashed p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing demo data — no Firebase project is configured, so nothing here is persisted.
            </span>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Demo persona</span>
              <span aria-hidden className="font-medium">
                Viewing as
              </span>
              <select
                aria-label="Demo persona"
                className="bg-background rounded-md border px-2 py-1"
                value={demoRole ?? 'gym-owner'}
                onChange={(e) => setDemoRole(e.target.value as NonNullable<typeof demoRole>)}
              >
                <option value="gym-owner">Youssef — gym owner</option>
                <option value="gym-staff">Salma — gym staff</option>
                <option value="member">Amina — member</option>
                <option value="prospect">A visitor — not a member</option>
                <option value="platform-admin">Platform admin</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* ── My gym (member section) ──────────────────────────────────── */}
      <MyGym />

      {/* ── Facts ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {gym.location?.address && (
          <Card>
            <CardContent className="flex gap-3 p-4">
              <MapPin className="mt-0.5 size-4 shrink-0 opacity-60" />
              <div className="text-sm">
                <p className="font-semibold">{gym.location.address}</p>
                <p className="text-muted-foreground">
                  {[gym.location.city, gym.location.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {(gym.contact?.phone || gym.contact?.email) && (
          <Card>
            <CardContent className="flex gap-3 p-4">
              <Phone className="mt-0.5 size-4 shrink-0 opacity-60" />
              <div className="text-sm">
                {gym.contact?.phone && <p className="font-semibold">{gym.contact.phone}</p>}
                {gym.contact?.email && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Mail className="size-3" /> {gym.contact.email}
                  </p>
                )}
                {gym.contact?.instagram && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <AtSign className="size-3" /> {gym.contact.instagram}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {gym.hours && (
          <Card>
            <CardContent className="flex gap-3 p-4">
              <Clock className="mt-0.5 size-4 shrink-0 opacity-60" />
              <div className="text-sm">
                <p className="font-semibold">Opening hours</p>
                <ul className="text-muted-foreground space-y-0.5">
                  {Object.entries(gym.hours)
                    .filter(([, v]) => v)
                    .slice(0, 3)
                    .map(([day, v]) => (
                      <li key={day}>
                        {DAY_NAMES[Number(day)]} {v!.open}–{v!.close}
                      </li>
                    ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {gym.branding?.description && (
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          {gym.branding.description}
        </p>
      )}

      {/* ── Timetable ────────────────────────────────────────────────── */}
      <section id="timetable" className="space-y-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarDays className="size-5" /> Timetable
        </h2>
        {days.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-sm">
              No classes are scheduled yet. Check back soon.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {days.map(({ label, slots: daySlots }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {new Date(label).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {daySlots.map((slot) => {
                    const cls: GymClass | undefined = classById.get(slot.classId);
                    const left = Math.max(0, slot.capacity - slot.booked);
                    return (
                      <div
                        key={slot.id}
                        className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {cls ? (
                              <a
                                href={`/g/${slug}/class/${cls.id}`}
                                className="hover:text-foreground hover:underline"
                              >
                                {cls.name}
                              </a>
                            ) : (
                              'Class'
                            )}
                          </p>
                          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                            <span className="tabular-nums">
                              {timeOfDay(slot.startsAt)}–{timeOfDay(slot.endsAt)}
                            </span>
                            {cls?.studio && <span>· {cls.studio}</span>}
                            {cls?.instructorName && <span>· {cls.instructorName}</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {cls && (
                            <Badge variant="secondary">{FOCUS_LABEL[cls.focus] ?? cls.focus}</Badge>
                          )}
                          <span
                            className={cn(
                              'text-muted-foreground flex items-center gap-1 text-xs tabular-nums',
                              left === 0 && 'text-red-500',
                            )}
                          >
                            <Users className="size-3" />
                            {left === 0 ? 'Full' : `${left} left`}
                          </span>
                          <SlotBookingActions slot={slot} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      {publishedPlans.length > 0 && (
        <section id="pricing" className="space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Dumbbell className="size-5" /> Membership
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {publishedPlans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-3xl font-black tracking-tight">
                    {formatMoney(plan.priceMinor, plan.currency)}
                  </p>
                  <p className="text-muted-foreground text-xs capitalize">per {plan.period}</p>
                  {plan.description && (
                    <p className="text-muted-foreground flex-1 text-sm">{plan.description}</p>
                  )}
                  {typeof plan.joinFeeMinor === 'number' && plan.joinFeeMinor > 0 && (
                    <p className="text-muted-foreground text-xs">
                      + {formatMoney(plan.joinFeeMinor, plan.currency)} join fee
                    </p>
                  )}
                  <Button asChild className="mt-auto w-full">
                    <a href={joinHref}>Join</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <footer className="text-muted-foreground border-border/60 border-t pt-4 text-xs">
        <a href="/gyms" className="hover:text-foreground underline underline-offset-4">
          Browse more gyms on SmartFit
        </a>
      </footer>
    </div>
  );
}
