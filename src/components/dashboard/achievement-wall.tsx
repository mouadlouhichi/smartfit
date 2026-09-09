'use client';

import {
  CalendarCheck,
  Dumbbell,
  Flag,
  Flame,
  Lock,
  Medal,
  Sunrise,
  Timer,
  TrendingUp,
  Trophy,
  Weight,
  type LucideIcon,
} from 'lucide-react';
import type { Achievement } from '@smartfit/core';
import { formatDateLabel } from '@smartfit/core';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  flag: Flag,
  flame: Flame,
  'calendar-check': CalendarCheck,
  dumbbell: Dumbbell,
  trophy: Trophy,
  'trending-up': TrendingUp,
  timer: Timer,
  weight: Weight,
  sunrise: Sunrise,
  medal: Medal,
};

/**
 * The achievements wall.
 *
 * Each badge is a crisp SVG medallion tinted with the achievement's accent so
 * it reads as earned metal rather than a flat icon chip. Locked badges render
 * as dimmed, monochrome outlines with a padlock — aspirational, never taunting.
 *
 * Unlocked tiles pop in once (`medal-pop`); the rest sit still, so the wall is
 * calm on every visit after the first celebration.
 */
export function AchievementWall({
  achievements,
  lockedNote,
}: {
  achievements: Achievement[];
  /** Shown under a locked tile when it is behind the Pro paywall. */
  lockedNote?: string;
}) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          {unlockedCount} of {achievements.length} earned
        </p>
        <div
          className="bg-secondary h-1.5 w-24 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={unlockedCount}
          aria-valuemin={0}
          aria-valuemax={achievements.length}
        >
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${(unlockedCount / Math.max(1, achievements.length)) * 100}%` }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {achievements.map((a) => (
          <AchievementTile key={a.id} achievement={a} lockedNote={lockedNote} />
        ))}
      </ul>
    </div>
  );
}

function AchievementTile({
  achievement,
  lockedNote,
}: {
  achievement: Achievement;
  lockedNote?: string;
}) {
  const a = achievement;
  const Icon = ICONS[a.icon] ?? Medal;

  return (
    <li
      className={cn(
        'relative flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 text-left transition-colors',
        a.unlocked ? 'bg-card border-transparent shadow-sm' : 'bg-secondary/50 border-border/60',
      )}
      aria-label={`${a.name}${a.unlocked ? ', earned' : ', locked'}`}
    >
      <Medallion tint={a.tint} unlocked={a.unlocked}>
        {a.unlocked ? (
          <Icon className="h-5 w-5" aria-hidden />
        ) : (
          <Lock className="h-4 w-4" aria-hidden />
        )}
      </Medallion>

      <div className="min-w-0">
        <p className={cn('truncate text-sm font-bold', !a.unlocked && 'text-muted-foreground')}>
          {a.name}
        </p>
        <p className="text-muted-foreground line-clamp-2 text-xs">{a.description}</p>
      </div>

      {a.unlocked && a.unlockedAt ? (
        <p className="text-muted-foreground text-[11px] font-semibold">
          Earned {formatDateLabel(a.unlockedAt)}
        </p>
      ) : (
        <p className="text-muted-foreground text-[11px] font-semibold tabular-nums">
          {a.progressLabel}
        </p>
      )}

      {/* Progress hairline for locked tiles */}
      {!a.unlocked && (
        <div className="bg-border/60 absolute inset-x-3.5 bottom-2 h-0.5 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{ width: `${a.progress}%`, backgroundColor: a.tint }}
          />
        </div>
      )}

      {!a.unlocked && lockedNote && (
        <span className="bg-primary/10 text-primary absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold">
          {lockedNote}
        </span>
      )}
    </li>
  );
}

/**
 * The metal disc behind every badge. Radial gradient from a bright top-left to
 * the achievement tint, a subtle inner rim, and a drop shadow when unlocked.
 * Locked it drops to a flat 12%-opacity disc so the whole tile recedes.
 */
function Medallion({
  tint,
  unlocked,
  children,
}: {
  tint: string;
  unlocked: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        unlocked ? 'medal-pop text-white' : 'text-muted-foreground',
      )}
      style={{
        background: unlocked
          ? `radial-gradient(120% 120% at 30% 20%, ${lighten(tint)} 0%, ${tint} 55%, ${darken(tint)} 100%)`
          : 'color-mix(in oklab, var(--secondary) 100%, transparent)',
        boxShadow: unlocked
          ? `inset 0 0 0 1px rgba(255,255,255,0.25), 0 6px 14px -6px ${tint}`
          : undefined,
        border: unlocked ? undefined : '1px solid var(--border)',
        color: unlocked ? '#fff' : undefined,
      }}
    >
      {children}
    </span>
  );
}

/** Tiny hex→rgb helpers for the medallion gradient stops. */
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  a.map((v, i) => Math.round(v + (b[i] - v) * t)) as [number, number, number];
const rgb = ([r, g, b2]: [number, number, number]) => `rgb(${r} ${g} ${b2})`;
function lighten(hex: string) {
  return rgb(mix(hexToRgb(hex), [255, 255, 255], 0.35));
}
function darken(hex: string) {
  return rgb(mix(hexToRgb(hex), [0, 0, 0], 0.3));
}
