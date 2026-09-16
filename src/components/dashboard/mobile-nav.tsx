'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, Globe2, Home, PlaySquare, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'home' | 'programs' | 'clips' | 'community' | 'profile';

interface Tab {
  id: TabId;
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const TABS: Tab[] = [
  { id: 'home', href: '/dashboard', label: 'Home', Icon: Home },
  { id: 'programs', href: '/dashboard/plan', label: 'Programs', Icon: Dumbbell },
  { id: 'clips', href: '/dashboard/progress', label: 'Clips', Icon: PlaySquare },
  { id: 'community', href: '/dashboard/goals', label: 'Community', Icon: Globe2 },
  { id: 'profile', href: '/dashboard/profile', label: 'Profile', Icon: UserRound },
];

function activeIdFor(pathname: string): TabId | null {
  if (pathname === '/dashboard') return 'home';
  if (pathname.startsWith('/dashboard/plan') || pathname.startsWith('/dashboard/body'))
    return 'programs';
  if (pathname.startsWith('/dashboard/progress') || pathname.startsWith('/dashboard/run'))
    return 'clips';
  if (pathname.startsWith('/dashboard/goals') || pathname.startsWith('/dashboard/coach'))
    return 'community';
  if (pathname.startsWith('/dashboard/profile')) return 'profile';
  return null;
}

/**
 * Mobile bottom navigation matching the reference assets: five evenly-spaced
 * icon tabs on a near-black bar. No hidden overflow, no raised centre item, so
 * every page keeps the same predictable 390px-first layout.
 */
export function MobileNav() {
  const pathname = usePathname();
  const activeId = activeIdFor(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <nav
        aria-label="Primary"
        className="pointer-events-auto mx-auto grid w-full max-w-md grid-cols-5 border-t border-white/10 bg-[#111111]/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-16px_34px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        {TABS.map((tab) => {
          const active = activeId === tab.id;
          const Icon = tab.Icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-colors active:scale-95',
                active ? 'text-white' : 'text-white/42 hover:text-white/80',
              )}
            >
              <Icon
                className={cn('h-5 w-5', active && 'drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]')}
                strokeWidth={active ? 2.8 : 2.2}
                aria-hidden
              />
              <span className="w-full truncate text-center text-[10px] leading-none font-black">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
