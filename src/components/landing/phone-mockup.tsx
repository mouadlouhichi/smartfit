import { Flame, Plus } from 'lucide-react';

/**
 * Lightweight CSS phone mockup previewing the Ember app home screen
 * (hero, daily-goal ring, quick actions) — no screenshot asset needed.
 */
export function PhoneMockup() {
  return (
    <div className="relative w-[280px] animate-float">
      <div className="rounded-[2.8rem] border-[10px] border-ink-warm bg-paper-warm shadow-2xl shadow-black/30">
        {/* notch */}
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-ink-warm/90" />
        <div className="px-5 pb-6 pt-5">
          <p className="eyebrow text-clay">Monday · Full Body</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold leading-tight text-ink-warm">
            Let&apos;s start strong!
          </h3>

          {/* goal card */}
          <div className="mt-4 flex items-center gap-3 rounded-3xl bg-white p-3.5 shadow-sm">
            <Ring pct={45} />
            <div className="flex-1">
              <p className="text-[11px] font-bold leading-tight text-ink-warm">You&apos;re 45% to your weekly goal</p>
              <p className="mt-0.5 text-[10px] text-clay">2/5 workouts</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-white">
              <Plus className="h-4 w-4" strokeWidth={3} />
            </span>
          </div>

          {/* quick actions */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {['Workout', 'Goals', 'Plan', 'Stats'].map((q) => (
              <div key={q} className="flex flex-col items-center gap-1.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-ember" />
                </span>
                <span className="text-[9px] font-semibold text-clay">{q}</span>
              </div>
            ))}
          </div>

          {/* summary cards */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[9px] font-semibold text-clay">Streak</p>
              <p className="flex items-center gap-1 font-display text-lg font-extrabold text-ink-warm">
                <Flame className="h-3.5 w-3.5 text-ember" /> 12
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[9px] font-semibold text-clay">Active</p>
              <p className="font-display text-lg font-extrabold text-ink-warm">240m</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#ECE8E2" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="#D6532F"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
      />
    </svg>
  );
}
