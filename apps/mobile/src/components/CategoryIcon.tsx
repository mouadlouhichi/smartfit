import React from 'react';
import {
  Activity,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  StretchHorizontal,
  Volleyball,
  Scale,
  Timer,
  Route,
  CheckCircle2,
  Percent,
  Ruler,
  type LucideIcon,
} from 'lucide-react-native';

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
  size = 18,
  color = '#15803D',
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const Icon = ICONS[name] ?? Activity;
  return <Icon size={size} color={color} strokeWidth={2.2} />;
}
