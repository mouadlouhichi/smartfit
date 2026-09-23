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

/**
 * Navigation, in two layers.
 *
 * `label` / `short` stay the plain English strings they always were: the
 * sitemap, the e2e selectors and the mobile pill all read them, and a nav item
 * whose accessible name changes with a preference is a worse test target, not
 * a better one.
 *
 * `labelKey` / `shortKey` are the catalog keys the *rendered* chrome uses, so a
 * French athlete sees "Progression" in the sidebar. Both live here rather than
 * in the components because nav copy is exactly the sort of thing that drifts
 * when it is written twice.
 */
export interface NavItem {
  href: string;
  /** English label — stable, used by non-React callers and tests. */
  label: string;
  /** Catalog key for the translated label. */
  labelKey: string;
  icon: LucideIcon;
  short: string;
  /** Catalog key for the compact mobile label. */
  shortKey: string;
}

/** Canonical app routes (also used by the mobile floating pill). */
export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    labelKey: 'nav.overview',
    icon: LayoutDashboard,
    short: 'Home',
    shortKey: 'nav.short.home',
  },
  {
    href: '/dashboard/library',
    label: 'Library',
    labelKey: 'nav.library',
    icon: BookOpen,
    short: 'Library',
    shortKey: 'nav.short.library',
  },
  {
    href: '/dashboard/personalize',
    label: 'Personalize',
    labelKey: 'nav.personalize',
    icon: SlidersHorizontal,
    short: 'For you',
    shortKey: 'nav.short.personalize',
  },
  {
    href: '/dashboard/run',
    label: 'Run',
    labelKey: 'nav.run',
    icon: Footprints,
    short: 'Run',
    shortKey: 'nav.short.run',
  },
  {
    href: '/dashboard/plan',
    label: 'Training plan',
    labelKey: 'nav.plan',
    icon: CalendarCheck,
    short: 'Plan',
    shortKey: 'nav.short.plan',
  },
  {
    href: '/dashboard/goals',
    label: 'Goals',
    labelKey: 'nav.goals',
    icon: Target,
    short: 'Goals',
    shortKey: 'nav.short.goals',
  },
  {
    href: '/dashboard/progress',
    label: 'Progress',
    labelKey: 'nav.progress',
    icon: LineChart,
    short: 'Progress',
    shortKey: 'nav.short.progress',
  },
  {
    href: '/dashboard/body',
    label: 'Body',
    labelKey: 'nav.body',
    icon: Ruler,
    short: 'Body',
    shortKey: 'nav.short.body',
  },
  {
    href: '/dashboard/fuel',
    label: 'Fuel',
    labelKey: 'nav.fuel',
    icon: UtensilsCrossed,
    short: 'Fuel',
    shortKey: 'nav.short.fuel',
  },
  {
    href: '/dashboard/profile',
    label: 'Profile',
    labelKey: 'nav.profile',
    icon: UserRound,
    short: 'Profile',
    shortKey: 'nav.short.profile',
  },
];

/** One dark-rail entry: a link plus the catalog key for its label. */
export interface RailItem {
  href: string;
  label: string;
  labelKey: string;
  icon: LucideIcon;
}

/**
 * Dark rail — used by both the desktop sidebar and the expandable mobile
 * menu. One item per app route, circular icons, matching labels.
 */
export const RAIL_ITEMS: RailItem[] = [
  { href: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/dashboard/library', label: 'Library', labelKey: 'nav.library', icon: BookOpen },
  {
    href: '/dashboard/personalize',
    label: 'Personalize',
    labelKey: 'nav.personalize',
    icon: SlidersHorizontal,
  },
  { href: '/dashboard/run', label: 'Run', labelKey: 'nav.run', icon: Footprints },
  { href: '/dashboard/progress', label: 'Progress', labelKey: 'nav.progress', icon: LineChart },
  { href: '/dashboard/coach', label: 'Insights', labelKey: 'nav.insights', icon: Sparkles },
  { href: '/dashboard/plan', label: 'Training', labelKey: 'nav.training', icon: CalendarCheck },
  { href: '/dashboard/goals', label: 'Goals', labelKey: 'nav.goals', icon: Target },
  { href: '/dashboard/body', label: 'Body', labelKey: 'nav.body', icon: Ruler },
  { href: '/dashboard/fuel', label: 'Fuel', labelKey: 'nav.fuel', icon: UtensilsCrossed },
  { href: '/dashboard/profile', label: 'Profile', labelKey: 'nav.profile', icon: UserRound },
];
