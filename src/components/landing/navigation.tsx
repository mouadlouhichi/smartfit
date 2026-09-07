'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'How it works', href: '/#how-it-works' },
  { name: 'Activity', href: '/#integrations' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'Guides', href: '/#guides' },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileMenuOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${isScrolled ? 'start-4 end-4 top-4' : 'start-0 end-0 top-0'}`}
    >
      <nav
        className={`relative z-50 mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? 'max-w-[1200px] rounded-2xl border border-[color:var(--foreground)]/10 bg-[color:var(--background)]/80 shadow-lg backdrop-blur-xl'
            : 'max-w-[1400px] bg-transparent'
        }`}
      >
        <div
          className={`flex items-center justify-between px-6 transition-all duration-500 lg:px-8 ${
            isScrolled ? 'h-14' : 'h-20'
          }`}
        >
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--foreground)] text-[color:var(--background)]">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M6.5 8.5v7M17.5 8.5v7M3.5 10.5v3M20.5 10.5v3M6.5 12h11" />
              </svg>
            </span>
            <span
              className={`font-display tracking-tight transition-all duration-500 ${
                isScrolled ? 'text-xl' : 'text-2xl'
              }`}
            >
              SmartFit
            </span>
          </Link>

          <div className="hidden items-center gap-12 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group relative text-sm font-semibold text-[color:var(--foreground)]/70 transition-colors duration-300 hover:text-[color:var(--foreground)] md:text-base"
              >
                {link.name}
                <span className="absolute start-0 -bottom-1 h-px w-0 bg-[color:var(--foreground)] transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className={`font-bold text-[color:var(--foreground)]/70 transition-all duration-500 hover:text-[color:var(--foreground)] ${
                isScrolled ? 'text-sm' : 'text-base'
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className={`inline-flex items-center rounded-full bg-[color:var(--primary)] text-white transition-all duration-500 hover:bg-[color:var(--primary)]/90 ${
                isScrolled ? 'h-8 px-4 text-sm' : 'px-6 py-2.5'
              }`}
            >
              Start training
            </Link>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="relative z-50 -me-2 flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--foreground)]/10 md:hidden"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile full-screen menu */}
      <div
        id="mobile-menu"
        aria-hidden={!isMobileMenuOpen}
        className={`fixed inset-0 z-40 bg-[color:var(--background)] transition-all duration-500 md:hidden ${
          isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col px-8 pt-28 pb-8">
          <div className="flex flex-1 flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-display text-5xl text-[color:var(--foreground)] transition-all duration-500 hover:text-[color:var(--muted-foreground)] ${
                  isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : '0ms' }}
              >
                {link.name}
              </Link>
            ))}
          </div>
          <div
            className={`flex gap-4 border-t border-[color:var(--foreground)]/10 pt-8 transition-all duration-500 ${
              isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? '300ms' : '0ms' }}
          >
            <Link
              href="/login"
              className="flex h-14 flex-1 items-center justify-center rounded-full border border-[color:var(--foreground)]/20 text-base"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex h-14 flex-1 items-center justify-center rounded-full bg-[color:var(--primary)] text-base text-white"
            >
              Start training
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-[color:var(--primary)] shadow-md"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.58}
        height={size * 0.58}
        fill="none"
        stroke="#FDF6F2"
        strokeWidth="2.6"
        strokeLinecap="round"
      >
        <path d="M6.5 8.5v7M17.5 8.5v7M3.5 10.5v3M20.5 10.5v3M6.5 12h11" />
      </svg>
    </span>
  );
}
