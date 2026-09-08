'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Moon, Sun, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand';
import { RAIL_ITEMS } from './nav-items';
import { MobileNav } from './mobile-nav';
import { DashboardHeader } from './dashboard-header';
import { DashboardModals } from './dashboard-modals';
import { ModalProvider, useModals } from './modal-context';
import { ConfirmProvider } from './confirm-context';
import { MigrationPrompt, StorageWarningBanner, SyncBanner } from './sync-banner';
import { InstallPrompt } from '@/components/pwa-install';

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ConfirmProvider>
      <ModalProvider>
        {/* Desktop layout is flush: no outer padding/gap, full-height rail */}
        <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] gap-0 p-0">
          {/* Dark rail (desktop) — matches the reference sidebar */}
          <aside className="bg-charcoal sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center rounded-none px-2 py-6 lg:flex">
            <Link
              href="/"
              aria-label="SmartFit home"
              className="mb-8 rounded-2xl transition-transform hover:scale-105"
            >
              <Logo size={44} />
            </Link>

            <nav className="flex flex-1 flex-col items-center gap-5">
              {RAIL_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    className="group flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                        active
                          ? 'text-primary bg-white shadow-lg shadow-black/20'
                          : 'text-white/55 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <item.icon
                        style={{ width: 21, height: 21 }}
                        strokeWidth={active ? 2.5 : 2.1}
                      />
                    </span>
                    <span
                      className={cn(
                        'text-[10px] leading-none font-medium transition-colors',
                        active ? 'text-white' : 'text-white/60 group-hover:text-white/90',
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 flex h-10 w-10 items-center justify-center">
              <ThemeToggleDark />
            </div>
          </aside>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
            <DashboardHeader />
            <MigrationPrompt />
            <SyncBanner />
            <StorageWarningBanner />
            <main className="flex-1 overflow-x-clip px-4 pt-1 pb-6 sm:px-6 lg:px-6 lg:pt-5">
              <div key={pathname} className="animate-page-in mx-auto w-full max-w-[1300px]">
                {children}
              </div>
            </main>
          </div>

          {/* Mobile nav — same dark rail, expands on tap */}
          <MobileNav />

          <GlobalLogCta />
          <DashboardModals />
          <InstallPrompt />
        </div>
      </ModalProvider>
    </ConfirmProvider>
  );
}

/**
 * Desktop global CTA — a SmartJib-style pill (icon + label + sliding arrow,
 * breathing ember glow) that replaces the old per-tab header "Log workout"
 * button. One primary action, reachable from every screen. Mobile already
 * has its global CTA: the raised white bolt in the bottom navigation, so
 * this pill is lg-only and never stacks with it.
 */
function GlobalLogCta() {
  const { openModal } = useModals();
  const pathname = usePathname();
  // The overview presents its own CTA — the glowing bolt in the weekly-goal
  // card — and both coach surfaces own the bottom-right corner with their
  // composer's Send button, so the floating pill yields there. Every other
  // screen keeps the global CTA.
  if (pathname === '/dashboard' || pathname === '/dashboard/coach') return null;
  return (
    <button
      onClick={() => openModal('workout')}
      className="zap-glow group bg-primary text-primary-foreground fixed right-8 bottom-8 z-40 hidden h-14 items-center gap-2 rounded-full px-5 text-sm font-extrabold transition-transform hover:-translate-y-0.5 active:scale-95 lg:inline-flex"
    >
      <Zap className="h-5 w-5" strokeWidth={2.6} fill="currentColor" aria-hidden />
      Log workout
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
    </button>
  );
}

/** Theme toggle tuned for the dark rail (light icon on charcoal). */
function ThemeToggleDark() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
