import Link from 'next/link';
import { LogoMark } from './navigation';

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how' },
      { label: 'Training styles', href: '/#plans' },
      { label: 'Open app', href: '/dashboard' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Onboarding', href: '/onboarding' },
      { label: 'Sign in', href: '/dashboard' },
      { label: 'Demo', href: '/dashboard' },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-white/10 bg-ink-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-lg font-extrabold tracking-tight text-paper">
              Smart<span className="text-volt">Fit</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/55">
            The platform to train with intention. Plan, log and understand your training — no wearables, no
            subscriptions, no data sold.
          </p>
          <p className="mt-4 text-xs uppercase tracking-widest text-paper/35">
            Private · Free · On-device
          </p>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-bold uppercase tracking-wider text-paper/70">{c.title}</p>
            <ul className="mt-4 space-y-3">
              {c.links.map((l) =>
                l.href.startsWith('/#') ? (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-paper/55 transition-colors hover:text-volt">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-paper/55 transition-colors hover:text-volt">
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-paper/40">
        © {new Date().getFullYear()} SmartFit · Train hard. Train smart.
      </div>
    </footer>
  );
}
