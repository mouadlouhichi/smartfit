import {
  LayoutDashboard,
  CalendarCheck,
  Target,
  LineChart,
  Ruler,
  UserRound,
  Sparkles,
  Footprints,
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
  { href: '/dashboard/run', label: 'Run', icon: Footprints, short: 'Run' },
  { href: '/dashboard/plan', label: 'Training plan', icon: CalendarCheck, short: 'Plan' },
  { href: '/dashboard/goals', label: 'Goals', icon: Target, short: 'Goals' },
  { href: '/dashboard/progress', label: 'Progress', icon: LineChart, short: 'Progress' },
  { href: '/dashboard/body', label: 'Body', icon: Ruler, short: 'Body' },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, short: 'Profile' },
];

/**
 * Dark rail — used by both the desktop sidebar and the expandable mobile
 * menu. One item per app route, circular icons, matching labels.
 *
 * Order is intentional: Overview first, then **Body** — the body-select
 * training hub — surfaced immediately so "train by muscle" is a first tap,
 * not a buried tab.
 */
export const RAIL_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/plan', label: 'Programs', icon: CalendarCheck },
  { href: '/dashboard/progress', label: 'Clips', icon: LineChart },
  { href: '/dashboard/goals', label: 'Community', icon: Target },
  { href: '/dashboard/body', label: 'Body', icon: Ruler },
  { href: '/dashboard/run', label: 'Run', icon: Footprints },
  { href: '/dashboard/coach', label: 'Coach', icon: Sparkles },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
];
