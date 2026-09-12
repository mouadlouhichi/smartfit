'use client';

import {
  Dumbbell,
  HeartPulse,
  Flame,
  StretchHorizontal,
  Volleyball,
  Moon,
  Activity,
  Scale,
  Percent,
  Ruler,
  Timer,
  Route,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  'heart-pulse': HeartPulse,
  flame: Flame,
  'stretch-horizontal': StretchHorizontal,
  volleyball: Volleyball,
  moon: Moon,
  activity: Activity,
  scale: Scale,
  percent: Percent,
  ruler: Ruler,
  timer: Timer,
  route: Route,
  'check-circle': CheckCircle2,
};

export function CategoryIcon({
  name,
  className,
  size = 18,
  style,
}: {
  name: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const Icon = ICONS[name] ?? Activity;
  return (
    <Icon className={className} style={{ width: size, height: size, ...style }} strokeWidth={2.2} />
  );
}

export const CATEGORY_ICON_OPTIONS = [
  'dumbbell',
  'heart-pulse',
  'flame',
  'stretch-horizontal',
  'volleyball',
  'moon',
  'activity',
] as const;

/**
 * Soft tinted chip for a category/unit accent hex — inline because the color
 * is data (never hardcoded in markup); opaque token colors as the fallback.
 */
export function chipAccentStyle(color: string | undefined): {
  color: string;
  backgroundColor: string;
} {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    return { color, backgroundColor: `${color}1c` };
  }
  return { color: 'var(--primary)', backgroundColor: 'var(--accent)' };
}

export const CATEGORY_COLOR_OPTIONS = [
  '#f3ff47',
  '#cbe02c',
  '#a8b80f',
  '#9fb41f',
  '#6f7d16',
  '#a3a3a3',
  '#6f6f6f',
  '#2b2b2b',
];
