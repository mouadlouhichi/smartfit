/** Pure-CSS phone mockup previewing the in-app dashboard (no image asset needed). */
export function PhoneMockup() {
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
              <div key={l} className="rounded-2xl border border-white/10 bg-ink-card p-3">
                <p className="text-sm">{ico}</p>
                <p className="mt-1 text-lg font-extrabold text-paper">{v}</p>
                <p className="text-[10px] text-paper/45">{l}</p>
              </div>
            ))}
          </div>

          {/* mini chart */}
          <div className="mx-4 my-3 rounded-2xl border border-white/10 bg-ink-card p-4">
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
