import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Dumbbell,
  Flame,
  HeartPulse,
  LineChart,
  Lock,
  Smartphone,
  Target,
  Timer,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LandingNav } from '@/components/landing/navigation';
import { FooterSection } from '@/components/landing/footer-section';
import { PLANS } from '@smartfit/core';

export const metadata: Metadata = {
  title: 'SmartFit — Train with intention',
  description:
    'A private, mobile-first fitness tracker. Plan your week, log every session, chase goals and watch your body trend — without wearables, subscriptions or sold data.',
};

const FEATURES = [
  {
    icon: Dumbbell,
    title: 'Log every workout',
    body: 'Strength, cardio, HIIT, mobility, sport — record duration, intensity, distance and exercises in seconds.',
    color: '#16a34a',
  },
  {
    icon: CalendarCheck2,
    title: 'Plan your week',
    body: 'Pick a proven split — Push/Pull/Legs, Upper/Lower, Full Body or cardio-focused — and schedule recurring sessions.',
    color: '#0ea5e9',
  },
  {
    icon: Target,
    title: 'Goals that reset',
    body: 'Weekly and monthly targets for workouts, active minutes, calories and distance, with live progress bars.',
    color: '#f59e0b',
  },
  {
    icon: Flame,
    title: 'Streaks & momentum',
    body: 'A daily training streak keeps you honest, while weekly stats show the work you actually put in.',
    color: '#ef4444',
  },
  {
    icon: LineChart,
    title: 'Progress you can see',
    body: 'Volume trends, activity mix and intensity spread over the last eight weeks — no spreadsheet required.',
    color: '#8b5cf6',
  },
  {
    icon: TrendingDown,
    title: 'Body trends',
    body: 'Track weight and measurements over time. The trend line tells the story the daily number never could.',
    color: '#ec4899',
  },
  {
    icon: Lock,
    title: 'Private by design',
    body: 'Everything lives on your device. No accounts, no wearables, no data brokers — your training is yours.',
    color: '#14b8a6',
  },
  {
    icon: Smartphone,
    title: 'Installs like an app',
    body: 'Mobile-first and responsive, with light and dark themes. Works great in the pocket or at the desk.',
    color: '#64748b',
  },
];

const STEPS = [
  { icon: Target, title: 'Set your strategy', body: 'Choose a training split that fits your life and tell us your rest days.' },
  { icon: CalendarCheck2, title: 'Schedule the week', body: 'Drop recurring sessions into the calendar so showing up is the only decision.' },
  { icon: Activity, title: 'Log as you train', body: 'One tap records each workout — duration, intensity, distance and exercises.' },
  { icon: BarChart3, title: 'Watch the trend', body: 'Streaks, goal progress and body trends compound into visible results.' },
];

const FAQS = [
  {
    q: 'Do I need a smartwatch or wearable?',
    a: 'No. SmartFit is built around manual logging, which is the point — you decide what counts as a session, and nothing depends on a device on your wrist.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Entirely in your browser using local storage. There is no account and no server receiving your workouts. You can export or erase everything with one tap.',
  },
  {
    q: 'What training plans are included?',
    a: 'Push/Pull/Legs (6-day), Upper/Lower (4-day), Full Body 3× (great for beginners), and a Cardio & Conditioning plan. You can also schedule any custom session.',
  },
  {
    q: 'Is SmartFit free?',
    a: 'Yes. Every feature is free. There is no premium tier and no subscription — fitness tracking should not have a paywall.',
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <Badge variant="accent" className="mb-5 gap-1.5 px-3 py-1">
            <Flame className="h-3.5 w-3.5" /> Private fitness tracking — free forever
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Train hard. <span className="text-primary">Train smart.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            SmartFit keeps your plan, your workouts and your progress in one calm place — and keeps your data on your
            device. No wearables, no subscriptions, no noise.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/onboarding">
                Start training <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-7">
              <Link href="/dashboard">Explore the demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No sign-up · Works offline · Light &amp; dark</p>

          {/* Hero stat strip */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Timer, label: 'Active minutes', value: '150+' },
              { icon: CalendarCheck2, label: 'Weekly sessions', value: '3–6' },
              { icon: Target, label: 'Plans', value: '4' },
              { icon: HeartPulse, label: 'Activity types', value: '6+' },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <s.icon className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need, nothing you don&apos;t</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Most fitness apps either over-complicate or under-count. SmartFit sits in the middle — precise enough to
          trust, simple enough to actually use.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${f.color}1a`, color: f.color }}
                >
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">From first plan to real progress</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border bg-card p-5">
                <span className="absolute right-4 top-4 text-3xl font-bold text-secondary">{i + 1}</span>
                <s.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">A plan for every schedule</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Start from a proven structure, then bend it to your week.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {PLANS.map((p) => (
            <Card key={p.id} className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <Badge variant="secondary">{p.sessionsPerWeek}× / week</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <ul className="mt-4 space-y-2">
                {p.split.map((slot, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium">{slot.focus}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">Questions</h2>
          <div className="mt-8 grid gap-3">
            {FAQS.map((f) => (
              <Card key={f.q}>
                <CardContent className="p-5">
                  <p className="font-semibold">{f.q}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Your next workout is the one that counts</h2>
            <p className="max-w-md text-primary-foreground/85">
              Set up your plan in a minute. SmartFit takes care of the rest — streaks, goals and trends included.
            </p>
            <Button asChild size="lg" variant="secondary" className="rounded-full bg-white text-emerald-800 hover:bg-white/90">
              <Link href="/onboarding">
                Get started free <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <FooterSection />
    </div>
  );
}
