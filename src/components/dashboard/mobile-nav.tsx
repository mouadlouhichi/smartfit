'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ClipboardList, CalendarCheck, Zap, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModals } from './modal-context';

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

type TabId = 'dashboard' | 'progress' | 'training' | 'profile';

interface Tab {
  id: TabId;
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

// Left pair (before the bolt) and right pair (after it).
const LEFT_TABS: Tab[] = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', Icon: TargetMark },
  { id: 'progress', href: '/dashboard/progress', label: 'Progress', Icon: ClipboardList },
];
const RIGHT_TABS: Tab[] = [
  { id: 'training', href: '/dashboard/plan', label: 'Training', Icon: CalendarCheck },
  { id: 'profile', href: '/dashboard/profile', label: 'Profile', Icon: UserRound },
];

function activeIdFor(pathname: string): TabId | null {
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/dashboard/progress') || pathname.startsWith('/dashboard/body'))
    return 'progress';
  if (pathname.startsWith('/dashboard/plan')) return 'training';
  if (pathname.startsWith('/dashboard/profile')) return 'profile';
  return null; // coach / goals / other screens: no tab highlighted
}

interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Mobile bottom navigation — five items: Dashboard, Progress, a raised center
 * bolt (logs a workout), Training and Profile.
 *
 * A single white "active" pill is measured from the active tab's position in
 * the bar and animated with a spring transition, so it glides horizontally
 * between tabs (the same technique as the reference app). The center bolt is
 * fixed and raised and is never part of the pill path.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { openModal } = useModals();
  const onCoach = pathname.startsWith('/dashboard/coach');

  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLAnchorElement | null>>>({});
  const [pill, setPill] = useState<PillRect | null>(null);
  const [animate, setAnimate] = useState(false);

  const activeId = activeIdFor(pathname);

  const measure = useCallback(() => {
    const nav = navRef.current;
    const el = activeId ? tabRefs.current[activeId] : null;
    if (!nav || !el) {
      setPill(null);
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setPill({
      x: box.left - navBox.left,
      y: box.top - navBox.top,
      width: box.width,
      height: box.height,
    });
  }, [activeId]);

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    const t = setTimeout(() => setAnimate(true), 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  if (onCoach) return null;

  const renderTab = (tab: Tab) => {
    const isActive = activeId === tab.id;
    const Icon = tab.Icon;
    return (
      <Link
        key={tab.id}
        ref={(el) => {
          tabRefs.current[tab.id] = el;
        }}
        href={tab.href}
        data-nav-item={tab.id}
        aria-label={tab.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-full py-2 transition-colors duration-300 active:scale-95',
          isActive ? 'text-primary' : 'text-white/55 hover:text-white/85',
        )}
      >
        <span className="flex items-center gap-1.5">
          <Icon className="h-5 w-5 shrink-0" strokeWidth={2.3} />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap text-xs font-bold text-charcoal transition-all duration-300 ease-out',
              isActive ? 'max-w-[72px] opacity-100' : 'max-w-0 opacity-0',
            )}
          >
            {tab.label}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
      <nav
        ref={navRef}
        className="pointer-events-auto relative flex w-full max-w-md items-center gap-1 rounded-full px-2 py-2 shadow-2xl shadow-black/30 ring-1 ring-white/10"
        style={{
          background: 'linear-gradient(180deg, #4d4a47 0%, #3d3b39 48%, #353331 100%)',
        }}
      >
        {/* Gliding active pill */}
        {pill && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-full bg-white shadow-sm"
            style={{
              transform: `translate(${pill.x}px, ${pill.y}px)`,
              width: pill.width,
              height: pill.height,
              transition: animate
                ? 'transform 380ms cubic-bezier(0.34, 1.32, 0.46, 1), width 380ms cubic-bezier(0.34, 1.32, 0.46, 1)'
                : 'none',
            }}
          />
        )}

        {LEFT_TABS.map(renderTab)}

        {/* Center: raised white bolt — log workout (fixed, raised, not a tab) */}
        <button
          type="button"
          onClick={() => openModal('workout')}
          aria-label="Log workout"
          className="relative z-20 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-black/5 transition-transform active:scale-90"
        >
          <Zap className="h-5 w-5 fill-charcoal text-charcoal" strokeWidth={1.6} />
        </button>

        {RIGHT_TABS.map(renderTab)}
      </nav>
    </div>
  );
}
