import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PhoneMockup } from './phone-mockup';

const STATS = [
  { big: '4', small: 'training styles', tag: 'PPL · UPPER/LOWER & MORE' },
  { big: '4', small: 'activity types', tag: 'STRENGTH · CARDIO · HIIT' },
  { big: '0', small: 'wearables required', tag: 'JUST YOU & THE GYM' },
  { big: '30s', small: 'to log a session', tag: 'NO FORMS, NO FUSS' },
];

function MarqueeRow() {
  const items = [...STATS, ...STATS];
  return (
    <div className="group relative overflow-hidden border-y border-black/10 bg-white py-5">
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-10 group-hover:[animation-play-state:paused]">
        {items.map((s, i) => (
          <div key={i} className="flex shrink-0 items-baseline gap-3 px-2">
            <span className="font-display text-3xl font-extrabold text-ink-warm sm:text-4xl">{s.big}</span>
            <span className="max-w-[9rem] text-sm font-semibold leading-tight text-clay">{s.small}</span>
            <span className="eyebrow hidden text-ember/70 lg:inline">{s.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <div className="bg-paper-warm">
      <section className="relative overflow-hidden px-5 pt-32 sm:px-6 sm:pt-40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow text-ember">Free · Private · No wearable</p>
            <h1 className="mt-4 font-display-tight text-5xl font-extrabold text-ink-warm sm:text-6xl lg:text-7xl">
              The SmartFit app to <span className="italic text-ember">train</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-clay">
              Track what each session <strong className="text-ink-warm">is</strong> — strength, cardio, HIIT — and the
              recurring plan it <strong className="text-ink-warm">belongs to</strong>. Two separate views that stay
              reconciled through every logged workout.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-2 rounded-full bg-ember px-7 py-4 text-base font-bold text-white shadow-lg shadow-ember/30 transition-transform hover:scale-[1.03] active:scale-95"
              >
                Start training free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="/#how-it-works"
                className="inline-flex items-center rounded-full border border-black/15 px-7 py-4 text-base font-semibold text-ink-warm transition-colors hover:bg-black/5"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-clay">
              No account · No card · Data stays on your device
            </p>
          </div>

          <div className="relative flex justify-center">
            <div className="pointer-events-none absolute -top-10 h-72 w-72 rounded-full bg-ember/15 blur-[100px]" />
            <PhoneMockup />
          </div>
        </div>
      </section>

      <div className="mt-16">
        <MarqueeRow />
      </div>
    </div>
  );
}
