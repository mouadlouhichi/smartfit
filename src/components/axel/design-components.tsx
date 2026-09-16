'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Bike,
  CheckCircle2,
  Dumbbell,
  FastForward,
  Flame,
  Gift,
  HeartPulse,
  Leaf,
  Play,
  Route,
  Search,
  SlidersHorizontal,
  StretchHorizontal,
  Timer,
  UserRound,
  Zap,
} from 'lucide-react';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { label: 'Strength', icon: Dumbbell, href: '/dashboard/plan' },
  { label: 'Cardio', icon: Bike, href: '/dashboard/run' },
  { label: 'HIIT', icon: Flame, href: '/dashboard/plan' },
  { label: 'Mobility', icon: StretchHorizontal, href: '/dashboard/body' },
  { label: 'Endurance', icon: FastForward, href: '/dashboard/run' },
  { label: 'Fat Loss', icon: UserRound, href: '/dashboard/goals' },
  { label: 'Toning', icon: SlidersHorizontal, href: '/dashboard/progress' },
  { label: 'Yoga', icon: Leaf, href: '/dashboard/body' },
];

type ProgramTone = 'strength' | 'cardio' | 'hiit' | 'mobility';

const PROGRAM_VISUALS: Record<
  ProgramTone,
  {
    icon: LucideIcon;
    metric: string;
    titleColor: string;
    image: string;
    objectPosition: string;
    panel: string;
    track: string;
    bars: number[];
  }
> = {
  strength: {
    icon: Dumbbell,
    metric: '5×5',
    titleColor: 'text-white',
    image: '/images/cat-strength.jpg',
    objectPosition: '44% 44%',
    panel: 'bg-primary text-primary-foreground',
    track: 'bg-primary',
    bars: [38, 64, 46, 80, 54],
  },
  cardio: {
    icon: HeartPulse,
    metric: '45m',
    titleColor: 'text-white',
    image: '/images/cat-cardio.jpg',
    objectPosition: '58% 38%',
    panel: 'bg-white/12 text-white',
    track: 'bg-[#cfff55]',
    bars: [52, 70, 44, 66, 88],
  },
  hiit: {
    icon: Flame,
    metric: '12 rnd',
    titleColor: 'text-white',
    image: '/images/cat-hiit.jpg',
    objectPosition: '42% 44%',
    panel: 'bg-orange-200 text-black',
    track: 'bg-orange-200',
    bars: [76, 42, 92, 58, 70],
  },
  mobility: {
    icon: StretchHorizontal,
    metric: '20m',
    titleColor: 'text-white',
    image: '/images/cat-mobility.jpg',
    objectPosition: '55% 42%',
    panel: 'bg-sky-200 text-black',
    track: 'bg-sky-200',
    bars: [34, 48, 58, 42, 62],
  },
};

const PROGRAMS: Array<{
  title: string;
  coach: string;
  level: string;
  meta: string;
  href: string;
  tone: ProgramTone;
}> = [
  {
    title: 'Strength',
    coach: 'Adrian Williams',
    level: 'Intermediate',
    meta: '1w · 5×',
    href: '/dashboard/plan',
    tone: 'strength',
  },
  {
    title: 'Cardio',
    coach: 'Alex Hoogan',
    level: 'Advance',
    meta: '2w · 4×',
    href: '/dashboard/run',
    tone: 'cardio',
  },
  {
    title: 'HIIT',
    coach: 'Maya Stone',
    level: 'Intense',
    meta: '1w · 3×',
    href: '/dashboard/plan',
    tone: 'hiit',
  },
  {
    title: 'Mobility',
    coach: 'SmartFit Coach',
    level: 'Beginner',
    meta: '1w · 4×',
    href: '/dashboard/body',
    tone: 'mobility',
  },
];

export function AxelSearchBar({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-sm font-semibold text-white/55 ring-1 ring-white/5">
        <Search className="h-4.5 w-4.5 shrink-0" aria-hidden />
        <span className="truncate">Search Program</span>
      </div>
      <Link
        href="/dashboard/profile"
        aria-label="Saved programs"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/75 ring-1 ring-white/5 transition-colors hover:text-white"
      >
        <Gift className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  );
}

export function AxelCategoryGrid({ className }: { className?: string }) {
  return (
    <section className={cn('grid gap-3', className)} aria-label="Categories">
      <h2 className="text-[1.55rem] leading-none text-white/85">Categories</h2>
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {CATEGORIES.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group axel-card-soft hover:border-primary/50 hover:bg-primary/10 flex aspect-[1.04] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] p-2 text-center transition-colors"
          >
            <item.icon
              className="text-primary h-6 w-6 transition-transform group-hover:scale-110 sm:h-7 sm:w-7"
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="text-[11px] leading-tight font-extrabold text-white sm:text-xs">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AxelExplorePrograms({ className }: { className?: string }) {
  return (
    <section className={cn('grid gap-3', className)} aria-label="Explore programs">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.55rem] leading-none text-white/85">Explore</h2>
        <Link
          href="/dashboard/plan"
          className="text-primary text-sm font-extrabold hover:underline"
        >
          See All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PROGRAMS.map((program) => (
          <AxelProgramCard key={program.title} {...program} />
        ))}
      </div>
    </section>
  );
}

function AxelProgramCard({
  title,
  coach,
  level,
  meta,
  href,
  tone,
}: {
  title: string;
  coach: string;
  level: string;
  meta: string;
  href: string;
  tone: ProgramTone;
}) {
  return (
    <Link href={href} className="group axel-card block overflow-hidden rounded-[1.15rem]">
      <AxelProgramVisual tone={tone} title={title} className="aspect-[0.86] rounded-t-[1.15rem]" />
      <div className="grid gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="text-primary grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-white">{coach}</p>
            <p className="truncate text-[10px] font-bold text-white/55">
              <span className="text-primary">{level}</span> · {meta}
            </p>
          </div>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-white/68">
          Maximize your training with a focused routine built for real progress.
        </p>
      </div>
    </Link>
  );
}

export function AxelWorkoutHero({
  title = 'Build your routine',
  subtitle = 'Choose a category, start a guided set, and keep the same dark neon UI on every page.',
  className,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <section className={cn('axel-card overflow-hidden rounded-[1.8rem]', className)}>
      <div className="relative min-h-[19rem] overflow-hidden bg-[#070807] p-4 sm:min-h-[23rem] sm:p-6">
        <AxelPhotoLayer src="/images/start-workout.jpg" objectPosition="54% 45%" priority />
        <div className="absolute right-4 bottom-5 z-10 hidden rounded-3xl bg-black/55 p-3 ring-1 ring-white/10 backdrop-blur sm:block">
          <div className="flex items-end gap-1.5" aria-hidden>
            {PROGRAM_VISUALS.strength.bars.map((height, index) => (
              <span
                key={index}
                className="bg-primary/85 w-2 rounded-full"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
          <p className="mt-2 text-[10px] font-black tracking-[0.18em] text-white/55 uppercase">
            Tempo
          </p>
        </div>
        <div className="relative z-20 flex h-full min-h-[17rem] flex-col justify-between sm:min-h-[20rem]">
          <div className="flex items-center justify-between text-white">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur">
              <Play className="h-4.5 w-4.5 fill-current" aria-hidden />
            </span>
            <span className="axel-title text-3xl tabular-nums">0:36</span>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur">
              <Gift className="h-4.5 w-4.5" aria-hidden />
            </span>
          </div>
          <div>
            <div className="mb-4 grid grid-cols-6 gap-1.5" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={cn('h-1 rounded-full', i === 0 ? 'bg-primary' : 'bg-white/18')}
                />
              ))}
            </div>
            <p className="text-primary text-xs font-black tracking-wide uppercase">Set 1 / 1</p>
            <h2 className="axel-italic mt-1 max-w-xs text-[3.4rem] text-white sm:text-[4.6rem]">
              {title}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed font-semibold text-white/70">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-[#101010] p-3.5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white">
          <Dumbbell className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-white">Adductor Rock Back + T Spine</p>
          <p className="text-xs font-semibold text-white/55">Next movement</p>
        </div>
        <Link
          href="/dashboard/plan"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm font-black"
        >
          Next
          <Zap className="h-3.5 w-3.5 fill-current" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function AxelProgramDetail({ className }: { className?: string }) {
  return (
    <section className={cn('axel-card overflow-hidden rounded-[1.8rem]', className)}>
      <div className="relative min-h-[18rem] overflow-hidden bg-[#070807] p-5 sm:min-h-[23rem] sm:p-7">
        <AxelPhotoLayer
          src={PROGRAM_VISUALS.cardio.image}
          objectPosition={PROGRAM_VISUALS.cardio.objectPosition}
          priority
        />
        <div className="relative z-20 mt-auto flex min-h-[15rem] flex-col justify-end sm:min-h-[19rem]">
          <h2 className="axel-italic text-[4rem] text-white sm:text-[5.5rem]">Cardio</h2>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-primary grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white/12">
              <HeartPulse className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-black text-white">Alex Hoogan</p>
              <p className="text-sm font-extrabold text-white/80">
                <span className="text-primary">Intermediate</span> · 1 week · 5× week
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-white/10 border-b border-white/10 bg-black/45 px-2 py-4 text-center">
        {[
          ['45', 'Minutes'],
          ['5×', 'Per Week'],
          ['1', 'Week'],
          ['↟', 'Intermediate'],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 px-1">
            <p className="axel-title text-4xl text-white">{value}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/48">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 p-5">
        <p className="text-sm leading-relaxed text-white/78">
          Maximize your strength training with Adrian&apos;s 5×5 program. Get ready to feel the
          thunder!
        </p>
        <h3 className="text-lg font-black tracking-tight text-white">Suggested week</h3>
        {['Day 1 - Adductor Rock Back + T Spine', 'Day 2 - Adductor Rock Back + T Spine'].map(
          (item, i) => (
            <Link
              href="/dashboard/plan"
              key={item}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-3 transition-colors hover:bg-white/[0.12]"
            >
              <span className="text-primary grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10">
                {i + 1}
              </span>
              <span className="min-w-0 truncate text-sm font-black text-white">{item}</span>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}

export function AxelSummaryTile({
  label,
  value,
  sub,
  icon = 'dumbbell',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
}) {
  return (
    <div className="axel-card-soft min-w-0 rounded-[1.35rem] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-black tracking-wide text-white/55 uppercase">{label}</p>
        <span className="bg-primary/10 text-primary grid h-8 w-8 shrink-0 place-items-center rounded-xl">
          <SummaryIcon name={icon} />
        </span>
      </div>
      <p className="axel-title mt-3 truncate text-[2.4rem] text-white">{value}</p>
      {sub && <p className="mt-1 truncate text-xs font-semibold text-white/48">{sub}</p>}
    </div>
  );
}

export function AxelAppShowcase({ className }: { className?: string }) {
  const miniCategories = CATEGORIES.slice(0, 4);
  return (
    <div
      className={cn('axel-card relative overflow-hidden rounded-[2rem] p-3', className)}
      aria-label="SmartFit component preview"
      role="img"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(20rem_18rem_at_62%_16%,rgba(156,255,0,0.16),transparent_62%)]" />
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.55rem] bg-[#050505] p-3 ring-1 ring-white/10 sm:p-4">
        <div className="mb-3 flex items-center justify-between text-[10px] font-black text-white/60">
          <span>9:41</span>
          <span className="flex items-center gap-1" aria-hidden>
            <span className="h-1.5 w-3 rounded-full bg-white/35" />
            <span className="h-1.5 w-3 rounded-full bg-white/55" />
            <span className="h-2 w-4 rounded-[0.35rem] border border-white/50" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.08] px-3 text-[11px] font-bold text-white/50 ring-1 ring-white/5">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">Search Program</span>
          </div>
          <span className="text-primary grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] ring-1 ring-white/5">
            <Gift className="h-4 w-4" aria-hidden />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {miniCategories.map((item) => (
            <div
              key={item.label}
              className="text-primary grid aspect-square place-items-center rounded-2xl bg-white/[0.075] ring-1 ring-white/5"
            >
              <item.icon className="h-4 w-4" strokeWidth={2.6} aria-hidden />
            </div>
          ))}
        </div>

        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] bg-[#0d0f0c] p-3 ring-1 ring-white/10">
          <AxelPhotoLayer src="/images/start-workout.jpg" objectPosition="58% 46%" />
          <div className="relative z-20 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              </span>
              <span className="axel-title text-2xl tabular-nums">0:36</span>
            </div>
            <div>
              <div className="mb-2 flex gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full',
                      i === 0 ? 'bg-primary' : 'bg-white/18',
                    )}
                  />
                ))}
              </div>
              <p className="text-primary text-[10px] font-black tracking-[0.18em] uppercase">
                Set 1 / 1
              </p>
              <p className="axel-italic text-[2.6rem] leading-[0.82] text-white">Routine</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniMetric label="Minutes" value="45" icon={Timer} />
          <MiniMetric label="Goal" value="82%" icon={CheckCircle2} />
        </div>
      </div>
    </div>
  );
}

function AxelProgramVisual({
  tone,
  title,
  className,
}: {
  tone: ProgramTone;
  title: string;
  className?: string;
}) {
  const visual = PROGRAM_VISUALS[tone];
  const Icon = visual.icon;

  return (
    <div className={cn('relative overflow-hidden bg-[#070807]', className)}>
      <AxelPhotoLayer src={visual.image} objectPosition={visual.objectPosition} />
      <div
        className={cn(
          'absolute top-3 left-3 z-20 grid h-10 w-10 place-items-center rounded-2xl shadow-[0_18px_34px_-22px_rgba(255,255,255,0.5)]',
          visual.panel,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="absolute top-3 right-3 z-20 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black text-white ring-1 ring-white/10 backdrop-blur">
        {visual.metric}
      </div>
      <div className="absolute right-4 bottom-4 z-20 flex items-end gap-1" aria-hidden>
        {visual.bars.map((height, index) => (
          <span
            key={index}
            className={cn('w-1.5 rounded-full opacity-85', visual.track)}
            style={{ height: `${Math.max(18, Math.round(height * 0.45))}px` }}
          />
        ))}
      </div>
      <p
        className={cn(
          'axel-italic absolute bottom-4 left-3 z-20 max-w-[78%] text-[2.6rem] drop-shadow sm:text-5xl',
          visual.titleColor,
        )}
      >
        {title}
      </p>
    </div>
  );
}

function AxelPhotoLayer({
  src,
  objectPosition = '50% 50%',
  priority = false,
}: {
  src: string;
  objectPosition?: string;
  priority?: boolean;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated editorial app art */}
      <img
        src={src}
        alt=""
        aria-hidden
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 h-full w-full scale-[1.03] object-cover transition-transform duration-700 group-hover:scale-110"
        style={{ objectPosition }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(32rem_24rem_at_72%_14%,rgba(156,255,0,0.18),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.26)_48%,rgba(0,0,0,0.08)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_26%,rgba(0,0,0,0.84)_100%)]" />
      <div className="bg-primary/75 absolute inset-x-0 top-0 h-1" />
    </>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.075] p-3 ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black tracking-wide text-white/45 uppercase">
          {label}
        </span>
        <Icon className="text-primary h-3.5 w-3.5" aria-hidden />
      </div>
      <p className="axel-title mt-1 text-3xl text-white">{value}</p>
    </div>
  );
}

function SummaryIcon({ name }: { name: string }) {
  switch (name) {
    case 'timer':
      return <Timer className="h-4 w-4" aria-hidden />;
    case 'route':
      return <Route className="h-4 w-4" aria-hidden />;
    case 'check-circle':
      return <CheckCircle2 className="h-4 w-4" aria-hidden />;
    default:
      return <CategoryIcon name={name} size={16} />;
  }
}
