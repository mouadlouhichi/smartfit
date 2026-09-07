'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, CalendarCheck, Zap, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModals } from './modal-context';

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

/** Brand target mark — the ringed-dot icon used on the Dashboard tab. */
function TargetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Mobile bottom navigation — five items matching the reference: Dashboard,
 * Progress, a raised center bolt (logs a workout / opens the coach), Training
 * and Profile. Active tabs use a white pill with an orange icon + charcoal
 * label; inactive tabs are muted. Hidden on the full-screen coach chat.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { openModal } = useModals();
  const onCoach = pathname.startsWith('/dashboard/coach');

  if (onCoach) return null;

  const tabs = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: TargetMark,
      active: isActive(pathname, '/dashboard'),
    },
    {
      href: '/dashboard/progress',
      label: 'Progress',
      icon: ClipboardList,
      active:
        pathname.startsWith('/dashboard/progress') || pathname.startsWith('/dashboard/body'),
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
      <nav
        className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-full px-2 py-2 shadow-2xl shadow-black/30 ring-1 ring-white/10"
        style={{
          background: 'linear-gradient(180deg, #4d4a47 0%, #3d3b39 48%, #353331 100%)',
        }}
      >
        {/* Left tabs: Dashboard / Progress */}
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full transition-all duration-200',
              tab.active
                ? 'bg-white px-2 py-2 shadow-sm'
                : 'px-2 py-2.5 text-white/45 hover:text-white/70',
            )}
          >
            <tab.icon
              className={cn('h-5 w-5 shrink-0', tab.active ? 'text-primary' : '')}
              strokeWidth={2.3}
            />
            {tab.active && (
              <span className="truncate text-xs font-bold text-charcoal">{tab.label}</span>
            )}
          </Link>
        ))}

        {/* Center: raised white bolt — quick log / coach */}
        <button
          type="button"
          onClick={() => openModal('workout')}
          aria-label="Log workout"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-black/5 transition-transform active:scale-90"
        >
          <Zap className="h-5 w-5 fill-charcoal text-charcoal" strokeWidth={1.6} />
        </button>

        {/* Right: Training */}
        <Link
          href="/dashboard/plan"
          aria-label="Training"
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full transition-all duration-200',
            isActive(pathname, '/dashboard/plan')
              ? 'bg-white px-2 py-2 shadow-sm'
              : 'px-2 py-2.5 text-white/45 hover:text-white/70',
          )}
        >
          <CalendarCheck
            className={cn(
              'h-5 w-5 shrink-0',
              isActive(pathname, '/dashboard/plan') ? 'text-primary' : '',
            )}
            strokeWidth={2.3}
          />
          {isActive(pathname, '/dashboard/plan') && (
            <span className="truncate text-xs font-bold text-charcoal">Training</span>
          )}
        </Link>

        {/* Right: Profile */}
        <Link
          href="/dashboard/profile"
          aria-label="Profile"
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full transition-all duration-200',
            isActive(pathname, '/dashboard/profile')
              ? 'bg-white px-2 py-2 shadow-sm'
              : 'px-2 py-2.5 text-white/45 hover:text-white/70',
          )}
        >
          <UserRound
            className={cn(
              'h-5 w-5 shrink-0',
              isActive(pathname, '/dashboard/profile') ? 'text-primary' : '',
            )}
            strokeWidth={2.3}
          />
          {isActive(pathname, '/dashboard/profile') && (
            <span className="truncate text-xs font-bold text-charcoal">Profile</span>
          )}
        </Link>
      </nav>
    </div>
  );
}
