import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from './navigation';

export function CtaSection() {
  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt/15 blur-[110px]" />
      <div className="relative mx-auto max-w-3xl rounded-[2rem] border border-volt/30 bg-gradient-to-br from-volt to-volt-soft p-10 text-center text-ink sm:p-14">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink">
          <LogoMark size={34} />
        </div>
        <h2 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Ready to build <span className="italic">something strong?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-ink/70">
          Join athletes training with intention. Start free — streaks, goals and trends included, no card.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-base font-extrabold text-volt transition-transform hover:scale-[1.03] active:scale-95"
          >
            Start building free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-ink/20 px-7 py-4 text-base font-bold text-ink transition-colors hover:bg-ink/5"
          >
            Open the demo
          </Link>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-ink/50">No account · No wearable</p>
      </div>
    </section>
  );
}
