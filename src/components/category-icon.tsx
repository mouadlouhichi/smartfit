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
  return <Icon className={className} style={{ width: size, height: size, ...style }} strokeWidth={2.2} />;
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

export const CATEGORY_COLOR_OPTIONS = [
  '#16a34a',
  '#0ea5e9',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#14b8a6',
  '#64748b',
];
