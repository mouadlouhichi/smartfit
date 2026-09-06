import Link from 'next/link';
import { LogoMark } from './navigation';

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Training styles', href: '/#plans' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Start free', href: '/onboarding' },
      { label: 'Sign in', href: '/dashboard' },
      { label: 'Open app', href: '/dashboard' },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-black/10 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="font-display text-xl font-extrabold tracking-tight text-ink-warm">
              Smart<span className="italic text-ember">Fit</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-clay">
            The free, private fitness tracker. Plan, log and understand your training — no wearables, no
            subscriptions, no data leaving your device.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-clay">
            Private · Free · On-device
          </p>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <p className="eyebrow text-ink-warm">{c.title}</p>
            <ul className="mt-4 space-y-3">
              {c.links.map((l) =>
                l.href.startsWith('/#') ? (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm font-medium text-clay transition-colors hover:text-ember">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm font-medium text-clay transition-colors hover:text-ember">
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 py-6 text-center text-xs text-clay">
        © {new Date().getFullYear()} SmartFit · Train hard. Train smart.
      </div>
    </footer>
  );
}
