import { SectionHeading } from './section';

const STEPS = [
  { n: 'I', title: 'Set your strategy', body: 'Pick a split that fits your life and tell us your rest days. Takes about a minute, and you can change it later.' },
  { n: 'II', title: 'Schedule the week', body: 'Drop recurring sessions into the calendar. SmartFit lays out the plan so showing up is the only decision left.' },
  { n: 'III', title: 'Log as you train', body: 'One tap records each workout — type, duration, intensity, distance. Your streaks, goals and trends update instantly.' },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading eyebrow="Process">
            Three steps. <span className="text-volt">A stronger you.</span>
          </SectionHeading>

          <div className="mt-12 grid gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-volt/15 text-lg font-extrabold text-volt">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-paper/60">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock week card (SmartJib-style UI block) */}
        <div className="lg:pt-16">
          <div className="rounded-3xl border border-white/10 bg-ink-card p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-paper">This week&apos;s plan</p>
              <span className="rounded-full bg-volt/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-volt">Synced</span>
            </div>
            <div className="mt-5 grid gap-2">
              {[
                ['Mon', 'Push — chest & shoulders', '55 min', true],
                ['Tue', 'Pull — back & biceps', '50 min', true],
                ['Wed', 'Morning run', '35 min', false],
                ['Fri', 'Legs — squats & hinges', '60 min', false],
                ['Sat', 'Football', '70 min', false],
              ].map(([day, title, mins, done]) => (
                <div key={title as string} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-ink p-3">
                  <span className="w-10 text-center text-xs font-bold uppercase text-paper/50">{day}</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      done ? 'border-volt bg-volt text-ink' : 'border-paper/25 text-transparent'
                    } text-[10px] font-black`}
                  >
                    ✓
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-paper/90">{title}</span>
                  <span className="text-xs text-paper/45">{mins}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-volt p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink/60">Weekly goal</p>
              <p className="mt-1 text-lg font-extrabold text-ink">5 of 5 workouts</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/15">
                <div className="h-full w-4/5 rounded-full bg-ink" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
