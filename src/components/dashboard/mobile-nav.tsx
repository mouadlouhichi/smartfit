'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, LayoutGrid, X, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { RAIL_ITEMS } from './nav-items';
import { useModals } from './modal-context';

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

/**
 * Mobile navigation — the same dark rail as desktop. Collapsed it is a floating
 * charcoal pill (current tab + log + expand); tapping expand opens a charcoal
 * sheet listing every rail item (Dashboard, Progress, Insights, Training,
 * Goals, Body, Profile) with the same circular-icon treatment.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { openModal } = useModals();
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const activeItem =
    RAIL_ITEMS.find((i) => isActive(pathname, i.href)) ?? RAIL_ITEMS[0];

  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="lg:hidden">
      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Expanded sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="max-h-[78dvh] overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-charcoal px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3 shadow-2xl shadow-black/40">
          {/* handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white/60">Menu</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Same items as the desktop rail */}
          <nav className="grid grid-cols-3 gap-3">
            {RAIL_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className="flex flex-col items-center gap-2 rounded-2xl py-3 transition-colors"
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                      active
                        ? 'bg-white text-primary shadow-lg shadow-black/25'
                        : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white',
                    )}
                  >
                    <item.icon style={{ width: 21, height: 21 }} strokeWidth={active ? 2.5 : 2.1} />
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium leading-none',
                      active ? 'text-white' : 'text-white/45',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => {
                setOpen(false);
                openModal('workout');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/40"
            >
              <Plus className="h-5 w-5" strokeWidth={2.8} /> Log workout
            </button>
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme(dark ? 'light' : 'dark')}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsed floating bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
        <nav className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-charcoal/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur">
          {/* Current tab */}
          <Link
            href={activeItem.href}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5"
          >
            <activeItem.icon className="h-5 w-5 text-white" strokeWidth={2.4} />
            <span className="text-sm font-semibold text-white">{activeItem.label}</span>
          </Link>

          {/* Log workout */}
          <button
            onClick={() => openModal('workout')}
            aria-label="Log workout"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-90"
          >
            <Plus className="h-5 w-5" strokeWidth={2.8} />
          </button>

          {/* Expand */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </div>
  );
}
