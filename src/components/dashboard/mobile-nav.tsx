'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ClipboardList, CalendarCheck, Footprints, Zap, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModals } from './modal-context';
import { useI18n } from '@/lib/i18n-context';

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

type TabId = 'dashboard' | 'progress' | 'run' | 'training' | 'profile';

interface Tab {
  id: TabId;
  href: string;
  /** English label — the accessible-name fallback and the e2e anchor. */
  label: string;
  /** Catalog key for the rendered label. */
  labelKey: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

// Left pair (before the bolt) and right pair (after it).
const LEFT_TABS: Tab[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    labelKey: 'nav.dashboard',
    Icon: TargetMark,
  },
  {
    id: 'progress',
    href: '/dashboard/progress',
    label: 'Progress',
    labelKey: 'nav.short.progress',
    Icon: ClipboardList,
  },
];
const RIGHT_TABS: Tab[] = [
  { id: 'run', href: '/dashboard/run', label: 'Run', labelKey: 'nav.run', Icon: Footprints },
  {
    id: 'training',
    href: '/dashboard/plan',
    label: 'Training',
    labelKey: 'nav.short.plan',
    Icon: CalendarCheck,
  },
  {
    id: 'profile',
    href: '/dashboard/profile',
    label: 'Profile',
    labelKey: 'nav.short.profile',
    Icon: UserRound,
  },
];

function activeIdFor(pathname: string): TabId | null {
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/dashboard/progress') || pathname.startsWith('/dashboard/body'))
    return 'progress';
  if (pathname.startsWith('/dashboard/run')) return 'run';
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
 * Mobile bottom navigation — Dashboard, Progress, a raised center bolt (logs a
 * workout), Run, Training and Profile. Run sits next to the bolt so the
 * dedicated run screen is one tap away on a phone.
 *
 * A single white "active" pill is measured from the active tab's position in
 * the bar and animated with a spring transition, so it glides horizontally
 * between tabs (the same technique as the reference app). The center bolt is
 * fixed and raised and is never part of the pill path.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { openModal } = useModals();
  const { t } = useI18n();
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

    // The active tab is sized to its own content, so the pill must follow any
    // geometry change — late webfont swap, container resize, label change —
    // rather than trusting a single measurement taken on mount.
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (navRef.current) ro.observe(navRef.current);
      const activeEl = activeId ? tabRefs.current[activeId] : null;
      if (activeEl) ro.observe(activeEl);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [measure, activeId]);

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
        aria-label={t(tab.labelKey) || tab.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative z-10 flex items-center justify-center rounded-full py-2 transition-colors duration-300 active:scale-95',
          // Only the active tab renders a label, so size it to its content and
          // let the icon-only tabs absorb the remaining space. Equal `flex-1`
          // widths sized every tab for a bare icon and then overflowed the
          // active one, pushing its icon outside the measured pill.
          isActive ? 'flex-initial px-2' : 'flex-1',
          'min-w-0',
          isActive ? 'text-primary' : 'text-white/55 hover:text-white/85',
        )}
      >
        <span className={cn('flex min-w-0 items-center', isActive ? 'gap-1.5' : 'gap-0')}>
          <Icon className="h-5 w-5 shrink-0" strokeWidth={2.3} />
          <span
            className={cn(
              // `truncate` (not a bare max-width clip) so a narrow phone
              // ellipsizes the label instead of slicing it mid-word.
              // Only opacity is transitioned: the tab is sized to its content,
              // so animating max-width would animate the tab's own geometry and
              // the pill would measure a half-open label.
              'text-charcoal min-w-0 truncate text-xs font-bold transition-opacity duration-300 ease-out',
              isActive ? 'max-w-[84px] opacity-100' : 'max-w-0 opacity-0',
            )}
          >
            {t(tab.labelKey) || tab.label}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
      <nav
        ref={navRef}
        className="pointer-events-auto relative flex w-full max-w-md items-center gap-1 rounded-full px-2 py-2 shadow-2xl ring-1 shadow-black/30 ring-white/10"
        style={{
          background:
            'linear-gradient(180deg, var(--ink-raise) 0%, var(--ink-foot) 48%, var(--ink-foot) 100%)',
        }}
      >
        {/* Gliding active pill */}
        {pill && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 rounded-full bg-white shadow-sm"
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
          aria-label={t('ui.logWorkout')}
          className="bg-volt relative z-20 flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_6px_20px_rgba(138,210,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-black/20 transition-transform active:scale-90"
        >
          <Zap
            className="h-5 w-5 fill-[var(--primary-foreground)] text-[var(--primary-foreground)]"
            strokeWidth={1.6}
          />
        </button>

        {RIGHT_TABS.map(renderTab)}
      </nav>
    </div>
  );
}
