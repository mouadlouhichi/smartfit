import { Check } from 'lucide-react';
import { Eyebrow, Section } from './section';

const STEPS = [
  {
    n: 'I',
    title: 'Tell us about your training',
    body: 'Pick a goal, your weekly availability and rest days. It takes about a minute, and you can change everything later.',
  },
  {
    n: 'II',
    title: 'Pick a training style',
    body: 'SmartFit lays out your weekly split — push/pull/legs, upper/lower, full body or cardio focus. Switch strategies anytime.',
  },
  {
    n: 'III',
    title: 'Log sessions as they happen',
    body: 'Add a workout in seconds and tag the activity type. Your plan, streaks, goals and trends update instantly.',
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works">
      <Eyebrow>Three steps</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
        Three steps. <span className="italic text-ember">A stronger week ahead.</span>
      </h2>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-ember font-display text-lg font-extrabold text-ember">
                {s.n}
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink-warm">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-clay">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Week plan mock card */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between">
            <p className="font-display text-base font-bold text-ink-warm">This week&apos;s split</p>
            <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-bold text-ember">Full Body 3×</span>
          </div>
          <div className="mt-5 grid gap-2.5">
            {[
              { d: 'Mon', t: 'Full body A', tag: 'Strength', on: true },
              { d: 'Wed', t: 'Full body B', tag: 'Strength', on: true },
              { d: 'Fri', t: 'Full body C + mobility', tag: 'Mobility', on: true },
              { d: 'Tue / Thu', t: 'Cardio / sport', tag: 'Optional', on: false },
            ].map((r) => (
              <div
                key={r.d}
                className={`flex items-center gap-3 rounded-2xl p-3 ${r.on ? 'bg-paper-warm' : 'bg-paper-warm/50'}`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    r.on ? 'bg-ember text-white' : 'bg-black/5 text-clay'
                  }`}
                >
                  {r.on ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-clay/40" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-ink-warm">{r.t}</p>
                  <p className="text-xs text-clay">{r.d}</p>
                </div>
                <span className="text-xs font-semibold text-clay">{r.tag}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-clay">3 sessions · rest built in</p>
            <span className="flex items-center gap-1.5 text-xs font-bold text-ember">
              <span className="h-2 w-2 rounded-full bg-ember animate-pulse-soft" /> Scheduled
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
