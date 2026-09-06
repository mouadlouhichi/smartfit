'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { DashboardHeader } from './dashboard-header';
import { DashboardModals } from './dashboard-modals';
import { ModalProvider, useModals } from './modal-context';
import { Plus } from 'lucide-react';

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ModalProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:flex-row">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card/50 px-4 py-7 lg:flex">
          <Link href="/" className="px-2">
            <Wordmark />
          </Link>
          <p className="eyebrow px-2 pt-8 pb-2 text-muted-foreground">Menu</p>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => <SideLink key={item.href} item={item} />)}
            <CoachLink />
          </nav>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
            <span className="text-[11px] leading-tight text-muted-foreground">
              Private by design
              <br />
              data stays on-device
            </span>
            <ThemeToggle />
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
          <DashboardHeader />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div key={pathname} className="mx-auto w-full max-w-5xl animate-fade-in">
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

function SideLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
          : 'text-clay hover:bg-secondary hover:text-foreground',
      )}
    >
      <item.icon style={{ width: 19, height: 19 }} strokeWidth={active ? 2.5 : 2.2} />
      {item.label}
    </Link>
  );
}

function CoachLink() {
  const pathname = usePathname();
  const active = pathname.startsWith('/dashboard/coach');
  return (
    <Link
      href="/dashboard/coach"
      className={cn(
        'mt-1 flex items-center gap-3 rounded-2xl border-2 border-dashed px-3.5 py-3 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border text-clay hover:bg-secondary hover:text-foreground',
      )}
    >
      <span className="text-base">✦</span>
      AI Coach
      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        New
      </span>
    </Link>
  );
}

function FloatingPill() {
  const pathname = usePathname();
  const { openModal } = useModals();
  const items = NAV_ITEMS.filter((i) => ['/dashboard', '/dashboard/plan', '/dashboard/progress', '/dashboard/profile'].includes(i.href));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink-warm/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur">
        {items.slice(0, 2).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-white/60',
              )}
              aria-label={item.label}
            >
              <item.icon style={{ width: 20, height: 20 }} strokeWidth={active ? 2.6 : 2.2} />
            </Link>
          );
        })}

        {/* Center action */}
        <button
          onClick={() => openModal('workout')}
          aria-label="Log workout"
          className="mx-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform active:scale-90"
          style={{ width: 52, height: 52 }}
        >
          <Plus style={{ width: 24, height: 24 }} strokeWidth={2.8} />
        </button>

        <Link
          href="/dashboard/coach"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
            pathname.startsWith('/dashboard/coach') ? 'bg-primary text-primary-foreground' : 'text-white/60',
          )}
          aria-label="AI Coach"
        >
          <span className="text-lg leading-none">✦</span>
        </Link>

        {items.slice(2).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-white/60',
              )}
              aria-label={item.label}
            >
              <item.icon style={{ width: 20, height: 20 }} strokeWidth={active ? 2.6 : 2.2} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
