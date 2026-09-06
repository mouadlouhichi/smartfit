import Link from 'next/link';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { PhoneMockup } from './phone-mockup';

const MARQUEE = [
  ['4', 'training plans', 'PPL & MORE'],
  ['6', 'activity types', 'STRENGTH · CARDIO · HIIT'],
  ['8 weeks', 'of trend history', 'VOLUME & BODY'],
  ['100%', 'on-device & free', 'NO ACCOUNT NEEDED'],
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-volt/20 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(#c8f135 1px, transparent 1px), linear-gradient(90deg, #c8f135 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 35%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-32 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-40">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-volt">
            <Sparkles className="h-3.5 w-3.5" /> Private fitness · free forever
          </div>

          <h1 className="mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            The SmartFit
            <br />
            app to <span className="text-volt">train.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/65">
            Plan your week, log every session and watch real progress compound — two separate views that stay
            reconciled through every change: <span className="font-semibold text-paper">what you train</span> and{' '}
            <span className="font-semibold text-paper">how it&apos;s going</span>.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className="group inline-flex items-center gap-2 rounded-full bg-volt px-7 py-4 text-base font-extrabold text-ink transition-transform hover:scale-[1.03] active:scale-95"
            >
              Start training free
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/15 px-6 py-4 text-base font-bold text-paper transition-colors hover:bg-white/5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-volt text-ink">
                <Play className="h-3.5 w-3.5 fill-ink" />
              </span>
              See how it works
            </a>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {['#c8f135', '#38bdf8', '#f472b6', '#fbbf24'].map((c, i) => (
                <span
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink text-xs font-bold text-ink"
                  style={{ backgroundColor: c }}
                >
                  {['A', 'M', 'K', 'J'][i]}
                </span>
              ))}
            </div>
            <div className="text-sm">
              <div className="flex tracking-wider text-volt">★★★★★</div>
              <p className="text-paper/55">Loved by home-gym &amp; studio athletes</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <PhoneMockup />
        </div>
      </div>

      {/* Stat marquee (mirrors SmartJib hero stat strip) */}
      <div className="relative border-y border-white/10 bg-ink-2">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-5 py-8 sm:grid-cols-4 sm:px-6">
          {MARQUEE.map(([big, label, tag], i) => (
            <div key={label} className={i > 0 ? 'sm:border-l sm:border-white/10 sm:pl-8' : ''}>
              <p className="text-3xl font-extrabold tracking-tight text-volt sm:text-4xl">{big}</p>
              <p className="mt-1 text-sm font-medium text-paper/80">{label}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-paper/40">{tag}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
