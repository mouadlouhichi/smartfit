'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, RAIL_ITEMS } from './nav-items';
import { DashboardHeader } from './dashboard-header';
import { DashboardModals } from './dashboard-modals';
import { ModalProvider, useModals } from './modal-context';

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ModalProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] gap-0 p-0 lg:gap-4 lg:p-4">
        {/* Dark rail (desktop) — matches the reference sidebar */}
        <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-24 shrink-0 flex-col items-center rounded-[2rem] bg-charcoal px-2 py-6 lg:flex">
          <Link
            href="/"
            aria-label="SmartFit home"
            className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-white/10"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          </Link>

          <nav className="flex flex-1 flex-col items-center gap-5">
            {RAIL_ITEMS.map((item) => {
              const active = isActive(pathname, item.href) && !item.label.includes('Settings');
              return (
                <Link key={item.label} href={item.href} className="group flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                      active
                        ? 'bg-white text-primary shadow-lg shadow-black/20'
                        : 'text-white/55 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <item.icon style={{ width: 21, height: 21 }} strokeWidth={active ? 2.5 : 2.1} />
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none transition-colors',
                      active ? 'text-white' : 'text-white/45 group-hover:text-white/70',
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
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div key={pathname} className="mx-auto w-full max-w-[1300px] animate-fade-in">
              {children}
            </div>
          </main>
        </div>

        {/* Floating pill nav (mobile) */}
        <FloatingPill />

        <DashboardModals />
      </div>
    </ModalProvider>
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

function FloatingPill() {
  const pathname = usePathname();
  const { openModal } = useModals();
  const items = NAV_ITEMS.filter((i) =>
    ['/dashboard', '/dashboard/plan', '/dashboard/progress', '/dashboard/profile'].includes(i.href),
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full bg-charcoal/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur">
        {items.slice(0, 2).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                active ? 'bg-white text-primary' : 'text-white/60',
              )}
            >
              <item.icon style={{ width: 20, height: 20 }} strokeWidth={active ? 2.6 : 2.2} />
            </Link>
          );
        })}

        <button
          onClick={() => openModal('workout')}
          aria-label="Log workout"
          className="mx-1 flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-90"
          style={{ width: 52, height: 52 }}
        >
          <Plus style={{ width: 24, height: 24 }} strokeWidth={2.8} />
        </button>

        <Link
          href="/dashboard/coach"
          aria-label="AI Coach"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
            pathname.startsWith('/dashboard/coach') ? 'bg-white text-primary' : 'text-white/60',
          )}
        >
          <span className="text-lg leading-none">✦</span>
        </Link>

        {items.slice(2).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                active ? 'bg-white text-primary' : 'text-white/60',
              )}
            >
              <item.icon style={{ width: 20, height: 20 }} strokeWidth={active ? 2.6 : 2.2} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
