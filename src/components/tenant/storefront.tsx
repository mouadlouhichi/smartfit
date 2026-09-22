'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Clock,
  MapPin,
  Phone,
  Mail,
  AtSign,
  CalendarDays,
  Users,
  Dumbbell,
  Menu,
  X,
  Check,
} from 'lucide-react';
import { isGymLive, type GymTenant } from '@smartfit/core';
import { useTenant, formatMoney } from '@/lib/tenant-context';
import { demoPersonaLabel } from '@/lib/tenant-demo';
import type { MembershipPlanDoc } from '@/lib/firebase/tenant-repo';
import { useAuth } from '@/lib/firebase/auth-context';
import { MyGym, SlotBookingActions } from './my-gym';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Artwork } from '@/components/ui/artwork';
import { ThemeToggle } from '@/components/theme-toggle';
import { GymGallery, brandColors } from './brand-media';
import { StorefrontHero } from './storefront-hero';
import { StorefrontMotion, MotionToggle, TrainingStatement } from './storefront-motion';
import { cn } from '@/lib/utils';
import {
  GYM_FOCUS_LABELS,
  classArtwork,
  upcomingStorefrontSlots,
  groupByDay,
  gymContactHref,
} from '@/lib/storefront-model';
export { groupByDay } from '@/lib/storefront-model';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeOfDay = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const LINKS = [
  ['#classes', 'Classes'],
  ['#timetable', 'Timetable'],
  ['#pricing', 'Memberships'],
  ['#visit', 'Visit us'],
];
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
function SectionHeading({
  number,
  eyebrow,
  title,
  description,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-3 flex items-center gap-3 text-[10px] font-semibold tracking-[.2em] uppercase">
        <span className="font-mono opacity-60">{number}</span>
        <span className="h-px w-7 bg-current opacity-30" />
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">{description}</p>
      )}
    </div>
  );
}

/** A plan request is a draft for the desk, never a client-side payment or entitlement. */
function PlanCard({
  plan,
  joinHref,
  featured,
}: {
  plan: MembershipPlanDoc;
  joinHref: string;
  featured: boolean;
}) {
  const t = useTenant(),
    toast = useToast();
  const pending = t.myInvoices.some((i) => i.planId === plan.id && i.status === 'draft');
  async function request() {
    const ok = await t.requestPlanPurchase(plan.id);
    toast(
      ok
        ? 'Request sent — pay at the desk to activate'
        : (t.mutationError ?? 'Could not request that plan'),
      ok ? 'success' : 'info',
    );
  }
  return (
    <article
      className={cn(
        'relative flex flex-col rounded-3xl border p-6 sm:p-7',
        featured ? 'border-transparent bg-zinc-950 text-white' : 'bg-card',
      )}
      style={featured ? { boxShadow: 'inset 0 3px 0 var(--gym-accent)' } : undefined}
    >
      <div className="mb-7 flex items-center justify-between gap-3">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            featured ? 'bg-white/10' : 'bg-secondary',
          )}
        >
          <Dumbbell className="size-4" />
        </span>
        <span
          className={cn(
            'rounded-full border px-3 py-1 text-[10px] font-medium capitalize',
            featured ? 'border-white/20 text-white/70' : 'text-muted-foreground',
          )}
        >
          {plan.period === 'pass' ? 'Gym pass' : `${plan.period} membership`}
        </span>
      </div>
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {(plan.priceMinor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </span>
        <span className={cn('text-xs', featured ? 'text-white/60' : 'text-muted-foreground')}>
          {plan.currency} / {plan.period}
        </span>
      </div>
      <p className={cn('mt-2 text-xs', featured ? 'text-white/55' : 'text-muted-foreground')}>
        {typeof plan.joinFeeMinor === 'number' && plan.joinFeeMinor > 0
          ? `+ ${formatMoney(plan.joinFeeMinor, plan.currency)} join fee`
          : 'No additional join fee listed'}
      </p>
      <div className={cn('my-6 border-t', featured ? 'border-white/15' : 'border-border')} />
      <p
        className={cn(
          'min-h-12 flex-1 text-sm leading-relaxed',
          featured ? 'text-white/75' : 'text-muted-foreground',
        )}
      >
        {plan.description || 'Speak with the front desk about what is included in this membership.'}
      </p>
      <p
        className={cn(
          'my-5 flex items-center gap-2 text-[11px]',
          featured ? 'text-white/60' : 'text-muted-foreground',
        )}
      >
        <Check className="size-3.5" />
        Confirmed by your gym’s front desk
      </p>
      {t.membership ? (
        pending ? (
          <Badge
            className="justify-center bg-amber-500/15 py-3 text-amber-600 dark:text-amber-300"
            variant="secondary"
          >
            Waiting for the desk
          </Badge>
        ) : (
          <Button
            className="w-full"
            variant={featured ? 'default' : 'outline'}
            onClick={request}
            disabled={t.mutating !== null || t.viewAs}
          >
            Choose this plan
            <ArrowUpRight className="size-4" />
          </Button>
        )
      ) : (
        <Button asChild className="w-full" variant={featured ? 'default' : 'outline'}>
          <a href={joinHref}>
            Join
            <ArrowUpRight className="size-4" />
          </a>
        </Button>
      )}
    </article>
  );
}
function ContactLink({
  kind,
  value,
}: {
  kind: 'phone' | 'email' | 'instagram' | 'whatsapp';
  value: string;
}) {
  const href = gymContactHref(kind, value);
  return href ? (
    <a
      className="break-all hover:underline"
      href={href}
      {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {value}
    </a>
  ) : (
    <span className="break-all">{value}</span>
  );
}

export function Storefront() {
  const t = useTenant();
  const { gym, classes, slots, plans, loading, error, slug, mode, demoRole, setDemoRole, can } = t;
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [focus, setFocus] = useState('all');
  const [date, setDate] = useState('all');
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  const classById = useMemo(() => new Map(classes.map((cls) => [cls.id, cls])), [classes]);
  // Demo fixtures and local time formatting must resolve in the browser, not diverge during hydration.
  const upcoming = useMemo(
    () => (interactive ? upcomingStorefrontSlots(slots) : []),
    [slots, interactive],
  );
  const allDays = useMemo(() => groupByDay(upcoming), [upcoming]);
  const days = useMemo(
    () =>
      groupByDay(
        upcoming.filter(
          (slot) =>
            (focus === 'all' || classById.get(slot.classId)?.focus === focus) &&
            (date === 'all' || new Date(slot.startsAt).toDateString() === date),
        ),
      ),
    [upcoming, classById, focus, date],
  );
  useEffect(() => {
    if (!interactive) return;
    if (focus !== 'all' && !classes.some((cls) => cls.focus === focus)) setFocus('all');
    if (date !== 'all' && !allDays.some((day) => day.label === date)) setDate('all');
  }, [classes, allDays, focus, date, interactive]);
  const publishedPlans = plans.filter((plan) => plan.published !== false);
  const focuses = [...new Set(classes.map((cls) => cls.focus))];
  const featuredPlan =
    publishedPlans.find((plan) => plan.period === 'month')?.id ?? publishedPlans[0]?.id;
  const joinHref = mode === 'cloud' && !user ? `/login?gym=${slug}` : `/g/${slug}#membership`;
  if (loading && !gym)
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6" role="status">
        <span className="sr-only">Loading gym</span>
        <div className="bg-muted h-80 animate-pulse rounded-3xl" />
      </div>
    );
  if (!gym && error)
    return (
      <div role="alert" className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-bold">Could not load this gym</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error}</p>
        <Button onClick={t.reload} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  if (!gym || !isGymLive(gym.status)) return <NotLive gym={gym} />;
  const { accent, foreground } = brandColors(gym);
  const address = [gym.location?.address, gym.location?.city, gym.location?.country]
    .filter(Boolean)
    .join(', ');
  const openDays = gym.hours ? Object.values(gym.hours).filter(Boolean).length : null;
  return (
    <StorefrontMotion
      className="gym-storefront bg-background relative isolate pb-24 sm:pb-0"
      style={{ '--gym-accent': accent, '--gym-foreground': foreground } as CSSProperties}
    >
      <a
        href="#classes"
        className="bg-card sr-only fixed top-2 left-2 z-50 rounded-xl border p-3 focus:not-sr-only"
      >
        Skip to classes
      </a>
      <nav
        aria-label="Gym navigation"
        className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href={`/g/${slug}`} className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: accent, color: foreground }}
            >
              <Dumbbell className="size-4" />
            </span>
            <span className="max-w-40 truncate text-sm font-bold tracking-tight sm:max-w-56">
              {gym.name}
            </span>
          </a>
          <div className="hidden items-center gap-6 lg:flex">
            {LINKS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <MotionToggle />
            <ThemeToggle />
            {can('checkin:door') && (
              <Button asChild size="sm" variant="outline" className="hidden text-xs sm:inline-flex">
                <Link href={`/g/${slug}/console`}>Manage gym</Link>
              </Button>
            )}
            <Button asChild size="sm" className="hidden text-xs sm:inline-flex">
              <a href={t.membership ? '#membership' : joinHref}>
                {t.membership ? 'My membership' : 'Get started'}
                <ArrowUpRight className="size-3.5" />
              </a>
            </Button>
            <button
              ref={menuButton}
              type="button"
              aria-label={menuOpen ? 'Close gym menu' : 'Open gym menu'}
              aria-expanded={menuOpen}
              aria-controls="gym-mobile-menu"
              className="hover:bg-secondary rounded-xl p-2 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              disabled={!interactive}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="gym-mobile-menu" className="grid gap-1 border-t px-4 py-3 lg:hidden">
            {[
              ...LINKS,
              [joinHref, t.membership ? 'My membership' : 'Get started'],
              ...(can('checkin:door') ? [[`/g/${slug}/console`, 'Manage gym']] : []),
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="hover:bg-secondary rounded-xl px-3 py-3 text-sm"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>
      <main className="relative mx-auto max-w-7xl space-y-16 px-4 pt-5 pb-12 sm:px-6 sm:pt-7 lg:space-y-24 lg:px-8">
        <div>
          {mode === 'demo' && (
            <div className="text-muted-foreground mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 text-[10px]">
              <span>Demo gym · sample data · session-only changes</span>
              <label className="flex items-center gap-2">
                <span>Viewing as</span>
                <select
                  aria-label="Demo persona"
                  disabled={!interactive}
                  className="bg-background max-w-full rounded-lg border px-2 py-1 text-[11px]"
                  value={demoRole ?? 'gym-owner'}
                  onChange={(e) => setDemoRole(e.target.value as NonNullable<typeof demoRole>)}
                >
                  {(
                    ['gym-owner', 'gym-staff', 'member', 'prospect', 'platform-admin'] as const
                  ).map((role) => (
                    <option key={role} value={role}>
                      {demoPersonaLabel(slug, role)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
            >
              <p>Some live details couldn’t be refreshed.</p>
              <p className="text-muted-foreground mt-1 text-xs">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={t.reload}>
                Retry live data
              </Button>
            </div>
          )}
          <StorefrontHero gym={gym} />
          <div className="flex flex-wrap items-center justify-between gap-4 border-b px-2 py-5 text-[10px] font-medium tracking-[.15em] uppercase">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2">
              {focuses.map((f) => (
                <span key={f} className="flex items-center gap-2">
                  <span className="size-1 rounded-full" style={{ backgroundColor: accent }} />
                  {GYM_FOCUS_LABELS[f] ?? f}
                </span>
              ))}
            </div>
            {gym.location?.city && (
              <a href="#visit" className="flex items-center gap-2">
                <MapPin className="size-3.5" />
                {gym.location.city}
                <ArrowUpRight className="size-3" />
              </a>
            )}
          </div>
        </div>
        <section data-reveal id="about" className="grid items-start gap-8 lg:grid-cols-2 lg:gap-20">
          <SectionHeading number="01" eyebrow="Meet your gym" title="Find your kind of strong." />
          <div>
            <p className="text-muted-foreground text-base leading-relaxed">
              {gym.branding?.description ||
                `Discover the classes, memberships and upcoming sessions at ${gym.name}. Explore what fits your goals, then make your next move.`}
            </p>
            <div className="mt-7 grid grid-cols-3 divide-x border-y py-5">
              {[
                [String(classes.length), 'Class formats'],
                [String(publishedPlans.length), 'Membership options'],
                [openDays === null ? '—' : String(openDays), 'Days open / week'],
              ].map(([value, label]) => (
                <div key={label} className="px-3 first:pl-0">
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                  <p className="text-muted-foreground mt-2 text-[10px]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section data-reveal id="classes" className="space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              number="02"
              eyebrow="Find your rhythm"
              title="Train your way."
              description="Explore the gym’s classes. Find something familiar—or your next challenge."
            />
            <a href="#timetable" className="flex items-center gap-2 text-xs font-semibold">
              Explore the timetable
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          {classes.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls, index) => (
                <Link
                  key={cls.id}
                  href={`/g/${slug}/class/${cls.id}`}
                  className="sf-class-card group bg-card focus-visible:ring-ring overflow-hidden rounded-3xl border transition-shadow hover:shadow-lg focus-visible:ring-2"
                >
                  <div className="relative h-56 overflow-hidden">
                    <Artwork
                      src={classArtwork(cls.focus)}
                      className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute top-4 left-4 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] text-white backdrop-blur-sm">
                      {GYM_FOCUS_LABELS[cls.focus] ?? cls.focus}
                    </span>
                    <span className="absolute top-4 right-4 text-[10px] font-medium text-white/75">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="absolute right-5 bottom-5 left-5 text-xl font-semibold tracking-tight text-white">
                      {cls.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {cls.minutes} min
                        </span>
                        <span className="capitalize">{cls.intensity} intensity</span>
                      </p>
                      {cls.instructorName && (
                        <p className="mt-2 text-[11px]">With {cls.instructorName}</p>
                      )}
                    </div>
                    <span className="bg-secondary group-hover:bg-primary group-hover:text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-2xl border border-dashed p-8 text-sm">
              The gym hasn’t published any classes yet. Check back soon.
            </p>
          )}
          {classes.length > 0 && (
            <p className="text-muted-foreground text-[10px]">
              Class cards use illustrative SmartFit artwork, not photographs of this gym.
            </p>
          )}
        </section>
        <TrainingStatement labels={focuses.map((f) => GYM_FOCUS_LABELS[f] ?? f)} />
        <section id="timetable" className="space-y-7">
          <SectionHeading
            number="03"
            eyebrow="Make time for you"
            title="Timetable"
            description="Find your next session. Check the available places and book a spot that works for you."
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2" aria-label="Filter timetable by class type">
              {['all', ...focuses].map((value) => (
                <button
                  key={value}
                  aria-pressed={focus === value}
                  onClick={() => setFocus(value)}
                  className={cn(
                    'rounded-full border px-4 py-2.5 text-xs font-medium transition-colors',
                    focus === value
                      ? 'border-transparent'
                      : 'hover:bg-secondary text-muted-foreground',
                  )}
                  style={
                    focus === value ? { backgroundColor: accent, color: foreground } : undefined
                  }
                >
                  {value === 'all' ? 'All classes' : (GYM_FOCUS_LABELS[value] ?? value)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <CalendarDays className="text-muted-foreground size-4" />
              <select
                aria-label="Timetable date"
                className="bg-card max-w-full rounded-xl border p-2.5 text-xs"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                <option value="all">All upcoming dates</option>
                {allDays.map((day) => (
                  <option key={day.label} value={day.label}>
                    {new Date(day.label).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!interactive ? (
            <p role="status" className="text-muted-foreground rounded-3xl border p-8 text-sm">
              Loading timetable…
            </p>
          ) : days.length ? (
            <div className="overflow-hidden rounded-3xl border">
              {days.map((day) => (
                <div
                  key={day.label}
                  className="grid border-b last:border-0 md:grid-cols-[155px_minmax(0,1fr)]"
                >
                  <div className="bg-secondary/40 p-5 md:p-6">
                    <h3 className="text-sm font-semibold">
                      {new Date(day.label).toLocaleDateString('en-GB', { weekday: 'long' })}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(day.label).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  </div>
                  <div className="bg-card divide-y">
                    {day.slots.map((slot) => {
                      const cls = classById.get(slot.classId),
                        left = Math.max(0, slot.capacity - slot.booked);
                      return (
                        <div key={slot.id} className="flex flex-wrap items-center gap-4 p-5">
                          <div className="min-w-20 text-xs">
                            <p className="text-base font-semibold tabular-nums">
                              {timeOfDay(slot.startsAt)}
                            </p>
                            <p className="text-muted-foreground mt-1 tabular-nums">
                              to {timeOfDay(slot.endsAt)}
                            </p>
                          </div>
                          <div className="min-w-32 flex-1">
                            <p className="text-sm font-semibold">
                              {cls ? (
                                <Link
                                  href={`/g/${slug}/class/${cls.id}`}
                                  className="hover:underline"
                                >
                                  {cls.name}
                                </Link>
                              ) : (
                                'Class'
                              )}
                            </p>
                            <p className="text-muted-foreground mt-1 text-[11px]">
                              {[cls?.instructorName, cls?.studio].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={cn(
                                'flex items-center gap-1.5 text-[11px]',
                                left
                                  ? 'text-muted-foreground'
                                  : 'text-amber-700 dark:text-amber-300',
                              )}
                            >
                              <Users className="size-3.5" />
                              {left ? `${left} left` : 'Full'}
                            </span>
                            <SlotBookingActions slot={slot} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed p-10 text-center">
              <CalendarDays className="text-muted-foreground mx-auto mb-3 size-7" />
              <p className="text-sm font-semibold">
                {upcoming.length
                  ? 'No sessions match these filters.'
                  : 'No classes are scheduled yet. Check back soon.'}
              </p>
              {upcoming.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setFocus('all');
                    setDate('all');
                  }}
                >
                  Reset timetable filters
                </Button>
              )}
            </div>
          )}
        </section>
        <section data-reveal id="pricing" className="space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              number="04"
              eyebrow="Invest in your routine"
              title="A plan for your next chapter."
            />
            <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
              Request your plan here. The front desk confirms your membership after payment at the
              gym.
            </p>
          </div>
          {publishedPlans.length ? (
            <div
              className={cn(
                'grid gap-4 sm:grid-cols-2',
                publishedPlans.length === 3
                  ? 'lg:grid-cols-3'
                  : publishedPlans.length > 3
                    ? 'xl:grid-cols-4'
                    : '',
              )}
            >
              {publishedPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  joinHref={joinHref}
                  featured={plan.id === featuredPlan}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-3xl border p-8">
              <p className="font-semibold">Membership details are on their way.</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Contact the gym to ask about current plans and availability.
              </p>
              <Button variant="outline" asChild className="mt-5">
                <a href="#visit">
                  Contact the gym
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </div>
          )}
        </section>
        <div className="bg-secondary/25 rounded-3xl border p-4 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                Your gym, connected
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {t.membership ? 'Your member space' : 'Ready to make it yours?'}
              </h2>
            </div>
            <Link
              href={`/g/${slug}/coaching`}
              className="flex items-center gap-2 text-xs font-semibold"
            >
              Coaching workspace
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          {loading || !interactive ? (
            <p id="membership" role="status" className="text-muted-foreground py-6 text-sm">
              Updating your membership…
            </p>
          ) : mode === 'cloud' && !user ? (
            <section id="membership" className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Sign in to join this gym, manage your membership and keep your bookings in one
                place.
              </p>
              <Button asChild>
                <Link href={joinHref}>
                  Sign in to get started
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </section>
          ) : (
            <MyGym />
          )}
        </div>
        <GymGallery gym={gym} />
        <section data-reveal id="visit" className="space-y-7">
          <SectionHeading
            number="05"
            eyebrow="See you here"
            title="Come find your people."
            description="Everything you need to plan your first—or your next—visit."
          />
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-7 text-white sm:p-10">
              <div
                aria-hidden="true"
                className="absolute -right-12 -bottom-20 size-72 rounded-full border-[40px] opacity-10"
                style={{ borderColor: accent }}
              />
              <MapPin className="relative mb-7 size-7" style={{ color: accent }} />
              <h3 className="relative text-2xl font-semibold tracking-tight">{gym.name}</h3>
              {address ? (
                <>
                  <p className="relative mt-3 max-w-sm text-sm leading-relaxed text-white/65">
                    {address}
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative mt-5 inline-flex items-center gap-2 border-b border-white/35 pb-1 text-xs font-medium"
                  >
                    Get directions
                    <ArrowUpRight className="size-4" />
                  </a>
                </>
              ) : (
                <p className="relative mt-3 text-sm text-white/65">
                  Ask the gym for location details before your visit.
                </p>
              )}
              <div className="relative mt-8 space-y-3 border-t border-white/15 pt-6 text-xs">
                {gym.contact?.phone && (
                  <p className="flex items-center gap-3">
                    <Phone className="size-4 shrink-0 text-white/45" />
                    <ContactLink kind="phone" value={gym.contact.phone} />
                  </p>
                )}
                {gym.contact?.email && (
                  <p className="flex items-center gap-3">
                    <Mail className="size-4 shrink-0 text-white/45" />
                    <ContactLink kind="email" value={gym.contact.email} />
                  </p>
                )}
                {gym.contact?.instagram && (
                  <p className="flex items-center gap-3">
                    <AtSign className="size-4 shrink-0 text-white/45" />
                    <ContactLink kind="instagram" value={gym.contact.instagram} />
                  </p>
                )}
                {gym.contact?.whatsapp && (
                  <p className="flex items-center gap-3">
                    <Phone className="size-4 shrink-0 text-white/45" />
                    <span>
                      WhatsApp: <ContactLink kind="whatsapp" value={gym.contact.whatsapp} />
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="bg-card rounded-3xl border p-7 sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Opening hours</h3>
                <Clock className="text-muted-foreground size-5" />
              </div>
              {gym.hours ? (
                <ul className="divide-y">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <li key={day} className="flex items-center justify-between gap-3 py-3 text-xs">
                      <span className="text-muted-foreground">{DAY_NAMES[day]}</span>{' '}
                      <span className="font-medium tabular-nums">
                        {gym.hours?.[day]
                          ? `${gym.hours[day]!.open}–${gym.hours[day]!.close}`
                          : 'Closed'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Opening hours have not been published. Contact the gym to confirm your visit.
                </p>
              )}
              <p className="text-muted-foreground mt-5 text-[10px]">
                Hours as provided by the gym. Check with the desk for holiday changes.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="bg-secondary/20 relative border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-8">
          <div>
            <p className="text-sm font-bold">{gym.name}</p>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Your training. Your community. Powered by SmartFit.
            </p>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-5 text-xs">
            <Link href="/gyms" className="hover:text-foreground">
              Browse more gyms on SmartFit
            </Link>
            <Link href="/support" className="hover:text-foreground">
              Contact SmartFit support
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
        <Button asChild variant="outline" className="flex-1">
          <a href="#timetable">
            <CalendarDays className="size-4" />
            Find a class
          </a>
        </Button>
        <Button asChild className="flex-1">
          <a href="#pricing">
            Memberships
            <ArrowUpRight className="size-4" />
          </a>
        </Button>
      </div>
    </StorefrontMotion>
  );
}
