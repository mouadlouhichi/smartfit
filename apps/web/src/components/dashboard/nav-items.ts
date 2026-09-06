import {
  LayoutDashboard,
  CalendarCheck,
  Target,
  LineChart,
  Ruler,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  short: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, short: 'Home' },
  { href: '/dashboard/plan', label: 'Training plan', icon: CalendarCheck, short: 'Plan' },
  { href: '/dashboard/goals', label: 'Goals', icon: Target, short: 'Goals' },
  { href: '/dashboard/progress', label: 'Progress', icon: LineChart, short: 'Progress' },
  { href: '/dashboard/body', label: 'Body', icon: Ruler, short: 'Body' },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound, short: 'Profile' },
];
