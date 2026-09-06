'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how', label: 'How it works' },
  { href: '/#plans', label: 'Plans' },
  { href: '/#faq', label: 'FAQ' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll + Escape to close while the full-screen menu is open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className={cn('fixed inset-x-0 z-50 transition-all duration-500', scrolled || open ? 'top-4' : 'top-0')}>
      <nav
        className={cn(
          'relative z-50 mx-auto transition-all duration-500',
          scrolled || open ? 'max-w-5xl px-4' : 'max-w-7xl px-4 sm:px-6',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between transition-all duration-500',
            scrolled || open
              ? 'h-14 rounded-2xl border border-white/10 bg-ink-2/80 px-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-5'
              : 'h-20 px-2',
          )}
        >
          <Link href="/" aria-label="SmartFit home" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-extrabold tracking-tight text-paper">
              Smart<span className="text-volt">Fit</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative text-sm font-medium text-paper/65 transition-colors hover:text-paper"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-volt transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-paper/70 transition-colors hover:text-paper"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-volt px-5 text-sm font-bold text-ink transition-transform hover:scale-[1.03] active:scale-95"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-paper md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Full-screen mobile menu */}
      <div
        className={cn(
          'fixed inset-0 -z-0 flex flex-col bg-ink/98 px-6 pt-28 backdrop-blur-xl transition-opacity duration-300 md:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="flex flex-col gap-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-4 text-2xl font-extrabold tracking-tight text-paper/80 transition-colors hover:bg-white/5 hover:text-volt"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-3 pb-10">
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-volt py-4 text-base font-bold text-ink"
          >
            Start training <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded-full border border-white/15 py-4 text-base font-semibold text-paper"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </header>
  );
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-volt shadow-[0_0_24px_-4px_rgba(200,241,53,0.6)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="#0b0e09" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6.5 8.5v7M17.5 8.5v7M3.5 10.5v3M20.5 10.5v3M6.5 12h11" />
      </svg>
    </span>
  );
}
