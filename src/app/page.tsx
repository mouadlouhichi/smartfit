import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Flame,
  LineChart,
  Lock,
  Play,
  Sparkles,
  Target,
  TrendingDown,
} from 'lucide-react';
import { LandingNav, LogoMark } from '@/components/landing/navigation';
import { PLANS } from '@smartfit/core';

export const metadata: Metadata = {
  title: 'SmartFit — Train Hard. Train Smart.',
  description:
    'A private, bold fitness tracker. Plan your week, log every session, chase goals and watch your body trend — no wearables, no subscriptions.',
};

const FEATURES = [
  { icon: BarChart3, title: 'Log every workout', body: 'Strength, cardio, HIIT, mobility & sport — duration, intensity, calories and distance in seconds.' },
  { icon: CalendarCheck2, title: 'Plan your week', body: 'PPL, Upper/Lower, Full Body or Cardio splits. Drop recurring sessions on the calendar and just show up.' },
  { icon: Target, title: 'Goals that reset', body: 'Weekly & monthly targets for workouts, minutes, calories and distance with live progress.' },
  { icon: Flame, title: 'Streaks & momentum', body: 'A daily training streak keeps you honest and your weekly stats show the real work.' },
  { icon: LineChart, title: 'Progress you can see', body: '8-week volume trends, activity mix and intensity spread — no spreadsheet required.' },
  { icon: TrendingDown, title: 'Body trends', body: 'Track weight and measurements. The trend line tells the story the daily number never could.' },
  { icon: Lock, title: 'Private by design', body: 'Everything lives on your device. No accounts, no wearables, no data brokers. Your training is yours.' },
  { icon: Sparkles, title: 'Installs like an app', body: 'Mobile-first and responsive with a bold dark theme and light mode. Built for the pocket.' },
];

const STEPS = [
  { n: '01', title: 'Set your strategy', body: 'Pick a split that fits your life and tell us your rest days.' },
  { n: '02', title: 'Schedule the week', body: 'Drop recurring sessions into the calendar so showing up is the only decision.' },
  { n: '03', title: 'Log as you train', body: 'One tap records each session — duration, intensity, distance, exercises.' },
  { n: '04', title: 'Watch the trend', body: 'Streaks, goals and body trends compound into visible results.' },
];

const FAQS = [
  { q: 'Do I need a smartwatch or wearable?', a: 'No. SmartFit is built around manual logging — you decide what counts as a session, with nothing depending on a device on your wrist.' },
  { q: 'Where is my data stored?', a: 'Entirely on your device. There is no account and no server receiving your workouts. Export or erase everything with one tap.' },
  { q: 'What plans are included?', a: 'Push/Pull/Legs, Upper/Lower, Full Body 3× and Cardio & Conditioning — plus any custom session you schedule.' },
  { q: 'Is SmartFit free?', a: 'Yes. Every feature is free. Fitness tracking should not have a paywall.' },
];

export default function HomePage() {
  return (
    // Always-render bold dark/volt marketing surface regardless of app theme.
    <div className="dark min-h-dvh bg-ink text-paper">
      <LandingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* glow + grid backdrop */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-volt/20 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(#c8f135 1px, transparent 1px), linear-gradient(90deg, #c8f135 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-32 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-40">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-volt">
              <Sparkles className="h-3.5 w-3.5" /> Private fitness · free forever
            </div>
            <h1 className="mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
              Train <span className="text-volt">Hard.</span>
              <br />
              Train <span className="underline decoration-volt/40 decoration-[6px] underline-offset-8">Smart.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-paper/65">
              Plan your week, log every session and watch real progress compound — in one bold, private place. No
              wearables. No subscriptions. No noise.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-2 rounded-full bg-volt px-7 py-4 text-base font-extrabold text-ink transition-transform hover:scale-[1.03] active:scale-95"
              >
                Start training free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/15 px-6 py-4 text-base font-bold text-paper transition-colors hover:bg-white/5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-volt text-ink">
                  <Play className="h-3.5 w-3.5 fill-ink" />
                </span>
                Explore demo
              </Link>
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
                <div className="flex text-volt">{'★★★★★'}</div>
                <p className="text-paper/55">Loved by home-gym &amp; studio athletes</p>
              </div>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative mx-auto w-full max-w-sm">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ── Marquee stats ─────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-ink-2">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-white/10 px-5 sm:grid-cols-4 sm:divide-x">
          {[
            ['150+', 'active min / week'],
            ['3–6', 'sessions per plan'],
            ['8 weeks', 'of trend history'],
            ['100%', 'on-device & free'],
          ].map(([v, l]) => (
            <div key={l} className="px-4 py-8 text-center">
              <p className="text-3xl font-extrabold tracking-tight text-volt sm:text-4xl">{v}</p>
              <p className="mt-1 text-sm text-paper/55">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-volt">Everything you need</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Precise enough to trust. Simple enough to <span className="text-volt">actually use.</span>
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-3xl border border-white/10 bg-ink-card p-6 transition-colors hover:border-volt/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-volt/15 text-volt transition-colors group-hover:bg-volt group-hover:text-ink">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/60">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section id="how" className="border-y border-white/10 bg-ink-2">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-volt">From first plan to real progress</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Four steps. That&apos;s it.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-white/10 bg-ink p-7">
                <span className="text-5xl font-extrabold text-volt/25">{s.n}</span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ─────────────────────────────────────────────── */}
      <section id="plans" className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-volt">A plan for every schedule</p>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Start from a proven structure.</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {PLANS.map((p) => (
            <div key={p.id} className="rounded-3xl border border-white/10 bg-ink-card p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold">{p.name}</h3>
                <span className="rounded-full bg-volt px-3 py-1 text-sm font-bold text-ink">{p.sessionsPerWeek}× / week</span>
              </div>
              <p className="mt-3 text-sm text-paper/60">{p.description}</p>
              <ul className="mt-5 grid gap-2.5">
                {p.split.map((slot, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-paper/80">
                    <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-volt" />
                    {slot.focus}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-white/10 bg-ink-2">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-6">
          <h2 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">Questions</h2>
          <div className="mt-10 grid gap-3">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-2xl border border-white/10 bg-ink-card p-6">
                <p className="font-bold">{f.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-6">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt/15 blur-[110px]" />
        <div className="relative mx-auto max-w-3xl rounded-[2rem] border border-volt/30 bg-gradient-to-br from-volt to-volt-soft p-10 text-center text-ink sm:p-14">
          <LogoMark size={48} />
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Your next workout is the one that counts.</h2>
          <p className="mx-auto mt-4 max-w-md text-ink/70">Set up your plan in a minute. SmartFit handles the rest — streaks, goals and trends included.</p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-base font-extrabold text-volt transition-transform hover:scale-[1.03] active:scale-95"
          >
            Get started free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-2">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-lg font-extrabold tracking-tight">
              Smart<span className="text-volt">Fit</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-paper/55">
            A private, bold fitness companion. Plan, log and understand your training — no wearables, no subscriptions,
            no data sold.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm text-paper/55">
            <li><a href="/#features" className="hover:text-volt">Features</a></li>
            <li><a href="/#plans" className="hover:text-volt">Training plans</a></li>
            <li><Link href="/dashboard" className="hover:text-volt">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">Get started</p>
          <ul className="mt-4 space-y-2.5 text-sm text-paper/55">
            <li><Link href="/onboarding" className="hover:text-volt">Onboarding</Link></li>
            <li><Link href="/dashboard" className="hover:text-volt">Open app</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-paper/40">
        © {new Date().getFullYear()} SmartFit · Train with intention.
      </div>
    </footer>
  );
}

/** Pure-CSS phone mockup previewing the in-app dashboard. */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[300px] animate-float">
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-volt/20 blur-3xl" />
      <div className="rounded-[2.6rem] border border-white/15 bg-ink-2 p-2.5 shadow-2xl shadow-black/60">
        <div className="overflow-hidden rounded-[2.1rem] bg-ink">
          {/* app header */}
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-paper/40">Push / Pull / Legs</p>
              <p className="text-base font-extrabold text-paper">Today&apos;s focus</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-volt text-sm font-bold text-ink">A</span>
          </div>

          {/* today card */}
          <div className="mx-4 mt-4 rounded-2xl bg-volt p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">Tuesday</p>
            <p className="text-lg font-extrabold leading-tight text-ink">Push — chest &amp; shoulders</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-volt">07:00</span>
              <span className="rounded-full bg-ink/10 px-2.5 py-1 text-[10px] font-bold text-ink">55 min</span>
            </div>
          </div>

          {/* stat grid */}
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
            {[
              ['🔥', '6', 'day streak'],
              ['✓', '4', 'workouts'],
              ['⏱', '3h 12m', 'active'],
              ['🏃', '12.4 km', 'distance'],
            ].map(([ico, v, l]) => (
              <div key={l} className="rounded-2xl border border-white/8 bg-ink-card p-3">
                <p className="text-sm">{ico}</p>
                <p className="mt-1 text-lg font-extrabold text-paper">{v}</p>
                <p className="text-[10px] text-paper/45">{l}</p>
              </div>
            ))}
          </div>

          {/* mini chart */}
          <div className="mx-4 my-3 rounded-2xl border border-white/8 bg-ink-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-paper">Last 8 weeks</p>
              <span className="text-[10px] font-bold text-volt">minutes ↑</span>
            </div>
            <div className="mt-3 flex h-20 items-end gap-1.5">
              {[40, 65, 52, 80, 58, 92, 74, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${h}%`, backgroundColor: i === 7 ? '#c8f135' : '#2b4016' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floating quick-add FAB */}
      <div className="absolute -right-3 bottom-16 flex h-14 w-14 items-center justify-center rounded-3xl bg-volt text-2xl font-bold text-ink shadow-xl shadow-volt/30">
        +
      </div>
    </div>
  );
}
