import { PLANS } from '@smartfit/core';
import { Eyebrow, Section } from './section';

const ACTIVITIES = [
  { code: 'STR', name: 'Strength' },
  { code: 'CRD', name: 'Cardio' },
  { code: 'HIT', name: 'HIIT' },
  { code: 'MOB', name: 'Mobility' },
  { code: 'SPT', name: 'Sports' },
  { code: 'RST', name: 'Active Rest' },
  { code: 'RUN', name: 'Running' },
  { code: 'CYC', name: 'Cycling' },
  { code: 'SWM', name: 'Swimming' },
  { code: 'ROW', name: 'Rowing' },
  { code: 'BOX', name: 'Boxing' },
  { code: 'YGA', name: 'Yoga' },
];

function Marquee({ items, reverse }: { items: typeof ACTIVITIES; reverse?: boolean }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden">
      <div
        className="flex w-max gap-3"
        style={{ animation: `marquee 32s linear infinite${reverse ? ' reverse' : ''}` }}
      >
        {row.map((a, i) => (
          <div
            key={i}
            className="flex w-44 shrink-0 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember/10 text-xs font-extrabold text-ember">
              {a.code}
            </span>
            <span className="text-sm font-bold text-ink-warm">{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlansSection() {
  return (
    <Section id="plans" alt>
      <Eyebrow>Training styles</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
        However you move, <span className="italic text-ember">we track it.</span>
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-clay">
        Four proven splits and every activity type you can log. Switch your strategy from Profile anytime — your
        history stays intact.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div key={p.id} className="rounded-3xl border border-black/10 bg-white p-6">
            <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-bold text-ember">
              {p.sessionsPerWeek}× / week
            </span>
            <h3 className="mt-4 font-display text-lg font-bold leading-tight text-ink-warm">{p.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-clay">{p.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 space-y-3">
        <Marquee items={ACTIVITIES} />
        <Marquee items={[...ACTIVITIES].reverse()} reverse />
      </div>
    </Section>
  );
}
