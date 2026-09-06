import {
  LayoutDashboard,
  CalendarCheck,
  Target,
  LineChart,
  Ruler,
  UserRound,
  Sparkles,
  Settings,
  BarChart3,
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
  { href: '/dashboard/plan', label: 'Training plan', icon: CalendarCheck, short: 'Plan' },
  { href: '/dashboard/goals', label: 'Goals', icon: Target, short: 'Goals' },
  { href: '/dashboard/progress', label: 'Progress', icon: LineChart, short: 'Progress' },
  { href: '/dashboard/body', label: 'Body', icon: Ruler, short: 'Body' },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, short: 'Profile' },
];

/**
 * Desktop dark rail — matches the reference sidebar (Dashboard, Progress,
 * Insights/AI, Training, Stats, Profile, Settings) with circular icons.
 */
export const RAIL_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/progress', label: 'Progress', icon: LineChart },
  { href: '/dashboard/coach', label: 'Insights', icon: Sparkles },
  { href: '/dashboard/plan', label: 'Training', icon: CalendarCheck },
  { href: '/dashboard/goals', label: 'Stats', icon: BarChart3 },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
  { href: '/dashboard/profile', label: 'Settings', icon: Settings },
];
