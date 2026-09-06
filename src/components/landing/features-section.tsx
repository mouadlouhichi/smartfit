import {
  BarChart3,
  CalendarCheck2,
  Flame,
  LineChart,
  Lock,
  Sparkles,
  Target,
  TrendingDown,
} from 'lucide-react';
import { SectionHeading } from './section';

const CAPABILITIES = [
  {
    n: '01',
    icon: BarChart3,
    title: 'Log it in seconds',
    body: 'Every session records its type, duration, intensity, estimated calories and distance. Add, edit and delete — the totals always reconcile.',
  },
  {
    n: '02',
    icon: CalendarCheck2,
    title: 'Pick a style that fits you',
    body: 'Choose from four training splits. SmartFit lays out your weekly schedule automatically — no spreadsheet, no guesswork. Switch any time.',
  },
  {
    n: '03',
    icon: Target,
    title: 'Chase a target that resets',
    body: 'Weekly and monthly goals for workouts, minutes, calories and distance. A persistent plan that rolls into a fresh week or month cleanly.',
  },
  {
    n: '04',
    icon: TrendingDown,
    title: 'Watch the body trend',
    body: 'Log weight and measurements and the trend line shows real change — progress that a single daily number could never reveal.',
  },
];

const MORE = [
  { icon: Flame, label: 'Streaks & momentum' },
  { icon: LineChart, label: '8-week volume charts' },
  { icon: Lock, label: 'Private & local-first' },
  { icon: Sparkles, label: 'Installs like an app' },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-y border-white/10 bg-ink-2">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
        <SectionHeading eyebrow="Capabilities">
          Manage your training. <span className="text-volt">See it pay off.</span>
        </SectionHeading>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div
              key={c.n}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-ink-card p-7 transition-colors hover:border-volt/40 sm:p-9"
            >
              <span className="text-5xl font-extrabold text-volt/20">{c.n}</span>
              <c.icon className="absolute right-7 top-7 h-7 w-7 text-volt transition-transform group-hover:scale-110" />
              <h3 className="mt-8 text-xl font-bold">{c.title}</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-paper/60">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MORE.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink p-5"
            >
              <m.icon className="h-5 w-5 shrink-0 text-volt" />
              <span className="text-sm font-semibold text-paper/85">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
