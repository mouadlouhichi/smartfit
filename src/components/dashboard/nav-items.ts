import {
  BookOpen,
  SlidersHorizontal,
  LayoutDashboard,
  CalendarCheck,
  Target,
  LineChart,
  Ruler,
  UserRound,
  Sparkles,
  Footprints,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  short: string;
}

/** Canonical app routes (also used by the mobile floating pill). */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, short: 'Home' },
  { href: '/dashboard/library', label: 'Library', icon: BookOpen, short: 'Library' },
  {
    href: '/dashboard/personalize',
    label: 'Personalize',
    icon: SlidersHorizontal,
    short: 'For you',
  },
  { href: '/dashboard/run', label: 'Run', icon: Footprints, short: 'Run' },
  { href: '/dashboard/plan', label: 'Training plan', icon: CalendarCheck, short: 'Plan' },
  { href: '/dashboard/goals', label: 'Goals', icon: Target, short: 'Goals' },
  { href: '/dashboard/progress', label: 'Progress', icon: LineChart, short: 'Progress' },
  { href: '/dashboard/body', label: 'Body', icon: Ruler, short: 'Body' },
  { href: '/dashboard/fuel', label: 'Fuel', icon: UtensilsCrossed, short: 'Fuel' },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, short: 'Profile' },
];

/**
 * Dark rail — used by both the desktop sidebar and the expandable mobile
 * menu. One item per app route, circular icons, matching labels.
 */
export const RAIL_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/library', label: 'Library', icon: BookOpen },
  { href: '/dashboard/personalize', label: 'Personalize', icon: SlidersHorizontal },
  { href: '/dashboard/run', label: 'Run', icon: Footprints },
  { href: '/dashboard/progress', label: 'Progress', icon: LineChart },
  { href: '/dashboard/coach', label: 'Insights', icon: Sparkles },
  { href: '/dashboard/plan', label: 'Training', icon: CalendarCheck },
  { href: '/dashboard/goals', label: 'Goals', icon: Target },
  { href: '/dashboard/body', label: 'Body', icon: Ruler },
  { href: '/dashboard/fuel', label: 'Fuel', icon: UtensilsCrossed },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
];
