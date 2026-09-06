import { Dumbbell, CalendarRange, LineChart, ShieldCheck } from 'lucide-react';
import { Eyebrow, Section } from './section';

const CAPS = [
  {
    n: '01',
    icon: Dumbbell,
    title: 'Know what it is',
    body: 'Every logged session is tagged to an activity type — strength, cardio, HIIT, mobility — so the workout stays separate from the plan behind it.',
  },
  {
    n: '02',
    icon: CalendarRange,
    title: 'Pick a style that fits you',
    body: 'Choose from four training strategies. SmartFit lays out your weekly split automatically — no spreadsheet, no guesswork.',
  },
  {
    n: '03',
    icon: LineChart,
    title: 'See it actually add up',
    body: 'Volume, calories, distance and streaks reconcile across every view. Logged sessions update your plan, goals and trends together.',
  },
  {
    n: '04',
    icon: ShieldCheck,
    title: 'Nothing ever leaves your device',
    body: 'There is no account and no server. Delete a session and its effect reverses cleanly. Export or erase everything with one tap.',
  },
];

export function FeaturesSection() {
  return (
    <Section id="features" alt>
      <Eyebrow>Training styles &amp; capabilities</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
        Log your training. <span className="italic text-ember">Track it</span> by plan or by session.
      </h2>

      <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-black/10 bg-black/10 sm:grid-cols-2">
        {CAPS.map((c) => (
          <div key={c.n} className="group relative bg-white p-8 transition-colors hover:bg-paper-warm">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ember/10 text-ember">
                <c.icon className="h-6 w-6" />
              </span>
              <span className="font-display text-4xl font-extrabold text-black/10 transition-colors group-hover:text-ember/30">
                {c.n}
              </span>
            </div>
            <h3 className="mt-6 font-display text-xl font-bold text-ink-warm">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-clay">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
