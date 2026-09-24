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
import {
  gymFocusLabel,
  isGymLive,
  planPeriodLabel,
  weekdayLabels,
  type GymTenant,
  type Intensity,
  type Locale,
} from '@smartfit/core';
import { useTenant, formatMoney } from '@/lib/tenant-context';
import { demoPersonaLabel } from '@/lib/tenant-demo';
import type { MembershipPlanDoc } from '@/lib/firebase/tenant-repo';
import { useAuth } from '@/lib/firebase/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { intlTag } from '@/lib/intl';
import { MyGym, SlotBookingActions } from './my-gym';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Artwork } from '@/components/ui/artwork';
import { Select } from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';
import { GymGallery, brandColors } from './brand-media';
import { StorefrontHero } from './storefront-hero';
import { StorefrontMotion, MotionToggle, TrainingStatement } from './storefront-motion';
import { cn } from '@/lib/utils';
import {
  classArtwork,
  upcomingStorefrontSlots,
  groupByDay,
  gymContactHref,
} from '@/lib/storefront-model';
export { groupByDay } from '@/lib/storefront-model';
const timeOfDay = (ms: number, locale: Locale) =>
  new Date(ms).toLocaleTimeString(intlTag(locale), { hour: '2-digit', minute: '2-digit' });
/** A timetable day heading. `label` is a `Date.toString()`, not an ISO date. */
const dayLabel = (label: string, locale: Locale) =>
  new Date(label).toLocaleDateString(intlTag(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const INTENSITY_KEYS: Record<Intensity, string> = {
  low: 'gym.store.intensity.low',
  moderate: 'gym.store.intensity.moderate',
  high: 'gym.store.intensity.high',
};
const PLAN_BADGE_KEYS: Record<MembershipPlanDoc['period'], string> = {
  month: 'gym.store.plan.badge.month',
  quarter: 'gym.store.plan.badge.quarter',
  year: 'gym.store.plan.badge.year',
  pass: 'gym.store.plan.badge.pass',
};
const LINKS = [
  ['#classes', 'gym.store.nav.classes'],
  ['#timetable', 'gym.store.nav.timetable'],
  ['#pricing', 'gym.store.nav.memberships'],
  ['#visit', 'gym.store.nav.visit'],
];
function NotLive({ gym }: { gym: GymTenant | null }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-xl font-bold">
        {t('gym.store.notLive.title', { name: gym?.name ?? t('gym.store.notLive.thisGym') })}
      </p>
      <p className="text-muted-foreground text-sm">
        {gym?.status === 'suspended'
          ? t('gym.store.notLive.suspended')
          : t('gym.store.notLive.settingUp')}
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
  const tenant = useTenant(),
    toast = useToast();
  const { t, locale } = useI18n();
  const pending = tenant.myInvoices.some((i) => i.planId === plan.id && i.status === 'draft');
  async function request() {
    const ok = await tenant.requestPlanPurchase(plan.id);
    toast(
      ok
        ? t('gym.store.plan.requestSent')
        : (tenant.mutationError ?? t('gym.store.plan.requestError')),
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
          {t(PLAN_BADGE_KEYS[plan.period])}
        </span>
      </div>
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {(plan.priceMinor / 100).toLocaleString(intlTag(locale), { maximumFractionDigits: 2 })}
        </span>
        <span className={cn('text-xs', featured ? 'text-white/60' : 'text-muted-foreground')}>
          {plan.currency} / {planPeriodLabel(plan.period, t)}
        </span>
      </div>
      <p className={cn('mt-2 text-xs', featured ? 'text-white/55' : 'text-muted-foreground')}>
        {typeof plan.joinFeeMinor === 'number' && plan.joinFeeMinor > 0
          ? t('gym.store.plan.joinFee', {
              amount: formatMoney(plan.joinFeeMinor, plan.currency),
            })
          : t('gym.store.plan.joinFeeNone')}
      </p>
      <div className={cn('my-6 border-t', featured ? 'border-white/15' : 'border-border')} />
      <p
        className={cn(
          'min-h-12 flex-1 text-sm leading-relaxed',
          featured ? 'text-white/75' : 'text-muted-foreground',
        )}
      >
        {plan.description || t('gym.store.plan.descriptionFallback')}
      </p>
      <p
        className={cn(
          'my-5 flex items-center gap-2 text-[11px]',
          featured ? 'text-white/60' : 'text-muted-foreground',
        )}
      >
        <Check className="size-3.5" />
        {t('gym.store.plan.confirmed')}
      </p>
      {tenant.membership ? (
        pending ? (
          <Badge
            className="justify-center bg-amber-500/15 py-3 text-amber-600 dark:text-amber-300"
            variant="secondary"
          >
            {t('gym.store.plan.waiting')}
          </Badge>
        ) : (
          <Button
            className="w-full"
            variant={featured ? 'default' : 'outline'}
            onClick={request}
            disabled={tenant.mutating !== null || tenant.viewAs}
          >
            {t('gym.store.plan.choose')}
            <ArrowUpRight className="size-4" />
          </Button>
        )
      ) : (
        <Button asChild className="w-full" variant={featured ? 'default' : 'outline'}>
          <a href={joinHref}>
            {t('gym.store.plan.join')}
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
  const tenant = useTenant();
  const { t, locale } = useI18n();
  const { gym, classes, slots, plans, loading, error, slug, mode, demoRole, setDemoRole, can } =
    tenant;
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
        <span className="sr-only">{t('gym.store.loading')}</span>
        <div className="bg-muted h-80 animate-pulse rounded-3xl" />
      </div>
    );
  if (!gym && error)
    return (
      <div role="alert" className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-bold">{t('gym.store.loadError')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error}</p>
        <Button onClick={tenant.reload} variant="outline" className="mt-4">
          {t('sync.retry')}
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
        {t('gym.store.skipToClasses')}
      </a>
      <nav
        aria-label={t('gym.store.nav.aria')}
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
                {t(label)}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <MotionToggle />
            <ThemeToggle />
            {can('checkin:door') && (
              <Button asChild size="sm" variant="outline" className="hidden text-xs sm:inline-flex">
                <Link href={`/g/${slug}/console`}>{t('gym.store.manage')}</Link>
              </Button>
            )}
            <Button asChild size="sm" className="hidden text-xs sm:inline-flex">
              <a href={tenant.membership ? '#membership' : joinHref}>
                {tenant.membership ? t('gym.store.myMembership') : t('gym.store.getStarted')}
                <ArrowUpRight className="size-3.5" />
              </a>
            </Button>
            <button
              ref={menuButton}
              type="button"
              aria-label={t(menuOpen ? 'gym.store.menu.close' : 'gym.store.menu.open')}
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
              [joinHref, tenant.membership ? 'gym.store.myMembership' : 'gym.store.getStarted'],
              ...(can('checkin:door') ? [[`/g/${slug}/console`, 'gym.store.manage']] : []),
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="hover:bg-secondary rounded-xl px-3 py-3 text-sm"
                onClick={() => setMenuOpen(false)}
              >
                {t(label)}
              </a>
            ))}
          </div>
        )}
      </nav>
      <main className="relative mx-auto max-w-7xl space-y-16 px-4 pt-5 pb-12 sm:px-6 sm:pt-7 lg:space-y-24 lg:px-8">
        <div>
          {mode === 'demo' && (
            <div className="text-muted-foreground mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 text-[10px]">
              <span>{t('gym.store.demo.banner')}</span>
              <span className="flex items-center gap-2">
                <span>{t('gym.store.demo.viewingAs')}</span>
                {/* Compact chrome: the same Select, sized down for the banner. */}
                <Select
                  aria-label={t('gym.store.demo.personaAria')}
                  disabled={!interactive}
                  size="compact"
                  className="max-w-full min-w-40"
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
                </Select>
              </span>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
            >
              <p>{t('gym.store.stale')}</p>
              <p className="text-muted-foreground mt-1 text-xs">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={tenant.reload}>
                {t('gym.store.staleRetry')}
              </Button>
            </div>
          )}
          <StorefrontHero gym={gym} />
          <div className="flex flex-wrap items-center justify-between gap-4 border-b px-2 py-5 text-[10px] font-medium tracking-[.15em] uppercase">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2">
              {focuses.map((f) => (
                <span key={f} className="flex items-center gap-2">
                  <span className="size-1 rounded-full" style={{ backgroundColor: accent }} />
                  {gymFocusLabel(f, t)}
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
          <SectionHeading
            number="01"
            eyebrow={t('gym.store.about.eyebrow')}
            title={t('gym.store.about.title')}
          />
          <div>
            <p className="text-muted-foreground text-base leading-relaxed">
              {gym.branding?.description || t('gym.store.about.fallback', { name: gym.name })}
            </p>
            <div className="mt-7 grid grid-cols-3 divide-x border-y py-5">
              {[
                [String(classes.length), t('gym.store.stat.classes')],
                [String(publishedPlans.length), t('gym.store.stat.plans')],
                [openDays === null ? '—' : String(openDays), t('gym.store.stat.days')],
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
              eyebrow={t('gym.store.classes.eyebrow')}
              title={t('gym.store.classes.title')}
              description={t('gym.store.classes.description')}
            />
            <a href="#timetable" className="flex items-center gap-2 text-xs font-semibold">
              {t('gym.store.classes.explore')}
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          {classes.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls, index) => (
                <Link
                  key={cls.id}
                  href={`/g/${slug}/class/${cls.id}`}
                  className="sf-class-card group bg-card focus-visible:ring-ring overflow-hidden rounded-3xl border transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="relative h-56 overflow-hidden">
                    <Artwork
                      src={classArtwork(cls.focus)}
                      className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute top-4 left-4 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] text-white backdrop-blur-sm">
                      {gymFocusLabel(cls.focus, t)}
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
                          {t('gym.store.class.minutes', { minutes: cls.minutes })}
                        </span>
                        <span>
                          {t('gym.store.class.intensity', {
                            level: t(INTENSITY_KEYS[cls.intensity]),
                          })}
                        </span>
                      </p>
                      {cls.instructorName && (
                        <p className="mt-2 text-[11px]">
                          {t('gym.store.class.with', { name: cls.instructorName })}
                        </p>
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
              {t('gym.store.classes.empty')}
            </p>
          )}
          {classes.length > 0 && (
            <p className="text-muted-foreground text-[10px]">
              {t('gym.store.classes.artworkNote')}
            </p>
          )}
        </section>
        <TrainingStatement labels={focuses.map((f) => gymFocusLabel(f, t))} />
        <section id="timetable" className="space-y-7">
          <SectionHeading
            number="03"
            eyebrow={t('gym.store.timetable.eyebrow')}
            title={t('gym.store.timetable.title')}
            description={t('gym.store.timetable.description')}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2" aria-label={t('gym.store.timetable.filterAria')}>
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
                  {value === 'all' ? t('gym.store.timetable.allClasses') : gymFocusLabel(value, t)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="text-muted-foreground size-4" aria-hidden />
              <Select
                id="timetable-date"
                aria-label={t('gym.store.timetable.dateAria')}
                size="sm"
                className="max-w-full min-w-40"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                <option value="all">{t('gym.store.timetable.allDates')}</option>
                {allDays.map((day) => (
                  <option key={day.label} value={day.label}>
                    {dayLabel(day.label, locale)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {!interactive ? (
            <p role="status" className="text-muted-foreground rounded-3xl border p-8 text-sm">
              {t('gym.store.timetable.loading')}
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
                      {weekdayLabels(locale, 'long')[new Date(day.label).getDay()]}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(day.label).toLocaleDateString(intlTag(locale), {
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
                              {timeOfDay(slot.startsAt, locale)}
                            </p>
                            <p className="text-muted-foreground mt-1 tabular-nums">
                              {t('gym.store.timetable.until', {
                                time: timeOfDay(slot.endsAt, locale),
                              })}
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
                                t('gym.store.class.one')
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
                              {left
                                ? t('gym.store.timetable.left', { count: left })
                                : t('gym.store.timetable.full')}
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
                  ? t('gym.store.timetable.noMatch')
                  : t('gym.store.timetable.empty')}
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
                  {t('gym.store.timetable.reset')}
                </Button>
              )}
            </div>
          )}
        </section>
        <section data-reveal id="pricing" className="space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              number="04"
              eyebrow={t('gym.store.pricing.eyebrow')}
              title={t('gym.store.pricing.title')}
            />
            <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
              {t('gym.store.pricing.note')}
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
              <p className="font-semibold">{t('gym.store.pricing.emptyTitle')}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t('gym.store.pricing.emptyBody')}
              </p>
              <Button variant="outline" asChild className="mt-5">
                <a href="#visit">
                  {t('gym.store.pricing.contact')}
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
                {t('gym.store.member.eyebrow')}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {tenant.membership ? t('gym.store.member.title') : t('gym.store.member.titleGuest')}
              </h2>
            </div>
            <Link
              href={`/g/${slug}/coaching`}
              className="flex items-center gap-2 text-xs font-semibold"
            >
              {t('gym.store.member.coaching')}
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          {loading || !interactive ? (
            <p id="membership" role="status" className="text-muted-foreground py-6 text-sm">
              {t('gym.store.member.updating')}
            </p>
          ) : mode === 'cloud' && !user ? (
            <section id="membership" className="space-y-4">
              <p className="text-muted-foreground text-sm">{t('gym.store.member.signInBody')}</p>
              <Button asChild>
                <Link href={joinHref}>
                  {t('gym.store.member.signInCta')}
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
            eyebrow={t('gym.store.visit.eyebrow')}
            title={t('gym.store.visit.title')}
            description={t('gym.store.visit.description')}
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
                    {t('gym.store.visit.directions')}
                    <ArrowUpRight className="size-4" />
                  </a>
                </>
              ) : (
                <p className="relative mt-3 text-sm text-white/65">
                  {t('gym.store.visit.noAddress')}
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
                      {t('gym.store.visit.whatsapp')}{' '}
                      <ContactLink kind="whatsapp" value={gym.contact.whatsapp} />
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="bg-card rounded-3xl border p-7 sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('gym.store.visit.hours')}</h3>
                <Clock className="text-muted-foreground size-5" />
              </div>
              {gym.hours ? (
                <ul className="divide-y">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <li key={day} className="flex items-center justify-between gap-3 py-3 text-xs">
                      <span className="text-muted-foreground">
                        {weekdayLabels(locale, 'long')[day]}
                      </span>{' '}
                      <span className="font-medium tabular-nums">
                        {gym.hours?.[day]
                          ? `${gym.hours[day]!.open}–${gym.hours[day]!.close}`
                          : t('gym.store.visit.closed')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">{t('gym.store.visit.hoursMissing')}</p>
              )}
              <p className="text-muted-foreground mt-5 text-[10px]">
                {t('gym.store.visit.hoursNote')}
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
              {t('gym.store.footer.tagline')}
            </p>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-5 text-xs">
            <Link href="/gyms" className="hover:text-foreground">
              {t('gym.store.footer.browse')}
            </Link>
            <Link href="/support" className="hover:text-foreground">
              {t('gym.store.footer.support')}
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              {t('gym.store.footer.privacy')}
            </Link>
          </div>
        </div>
      </footer>
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
        <Button asChild variant="outline" className="flex-1">
          <a href="#timetable">
            <CalendarDays className="size-4" />
            {t('gym.store.mobile.findClass')}
          </a>
        </Button>
        <Button asChild className="flex-1">
          <a href="#pricing">
            {t('gym.store.mobile.memberships')}
            <ArrowUpRight className="size-4" />
          </a>
        </Button>
      </div>
    </StorefrontMotion>
  );
}
