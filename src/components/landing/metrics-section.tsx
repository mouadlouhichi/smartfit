import { SectionHeading } from './section';

const METRICS = [
  { value: '4', label: 'Training styles', sub: 'PPL · Upper/Lower · Full Body · Cardio' },
  { value: '6+', label: 'Activity types', sub: 'Strength, cardio, HIIT, mobility…' },
  { value: '8', label: 'Weeks of trends', sub: 'Volume, activity mix & intensity' },
  { value: '0', label: 'Accounts or wearables', sub: 'Runs fully on your device' },
];

export function MetricsSection() {
  return (
    <section className="border-y border-white/10 bg-ink-2">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
        <SectionHeading eyebrow="At a glance">
          Free training, <span className="text-volt">made simple.</span>
        </SectionHeading>

        <div className="mt-6 flex items-center gap-2 text-xs text-paper/45">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-volt" />
          Live · runs in your pocket, no account
        </div>

        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-ink-card p-7">
              <p className="text-4xl font-extrabold tracking-tight text-volt sm:text-5xl">{m.value}</p>
              <p className="mt-3 text-sm font-bold text-paper">{m.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-paper/50">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
