'use client';

import Link from 'next/link';
import { AnimatedWave } from './animated-wave';

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { name: 'Features hub', href: '/#features' },
      { name: 'How it works', href: '/#how-it-works' },
      { name: 'Training styles', href: '/#integrations' },
      { name: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Training',
    links: [
      { name: 'All styles explained', href: '/#plans' },
      { name: 'Push / Pull / Legs', href: '/#plans' },
      { name: 'Upper / Lower', href: '/#plans' },
      { name: 'Full Body 3×', href: '/#plans' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { name: 'Training guides', href: '/#guides' },
      { name: 'Session vs plan', href: '/#features' },
      { name: 'How it works', href: '/#how-it-works' },
      { name: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'App',
    links: [
      { name: 'Open dashboard', href: '/dashboard' },
      { name: 'Get started', href: '/onboarding' },
      { name: 'Sign in', href: '/login' },
      { name: 'Your data', href: '/#security' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy policy', href: '/privacy' },
      { name: 'Terms of use', href: '/terms' },
      { name: 'Export & delete', href: '/dashboard/profile' },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="relative border-t border-[color:var(--foreground)]/10">
      <div className="pointer-events-none absolute inset-0 h-64 overflow-hidden opacity-20">
        <AnimatedWave />
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 gap-12 md:grid-cols-7 lg:gap-8">
            <div className="col-span-2">
              <Link href="/" className="mb-6 inline-flex items-center gap-2">
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
                <span className="font-display text-2xl">SmartFit</span>
              </Link>
              <p className="max-w-xs leading-relaxed text-[color:var(--muted-foreground)]">
                The free, private workout tracker. Plan, log and understand your training — no
                wearables, no subscriptions, no trackers, no ads.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                SmartFit is a tracker, not a medical device — train within your limits.
              </p>
            </div>

            {FOOTER_LINKS.map(({ title, links }) => (
              <div key={title}>
                <h3 className="mb-6 text-sm font-medium">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={`${title}-${link.name}`}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-2 text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--foreground)]/10 py-8">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            © {new Date().getFullYear()} SmartFit · Train hard. Train smart.
          </p>
          <div className="flex gap-4 text-xs text-[color:var(--muted-foreground)]">
            <Link href="/#features" className="hover:text-[color:var(--foreground)]">
              Features
            </Link>
            <Link href="/#integrations" className="hover:text-[color:var(--foreground)]">
              Activity
            </Link>
            <Link href="/#guides" className="hover:text-[color:var(--foreground)]">
              Guides
            </Link>
            <Link href="/privacy" className="hover:text-[color:var(--foreground)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[color:var(--foreground)]">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
