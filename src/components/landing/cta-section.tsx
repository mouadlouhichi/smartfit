import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from './navigation';

export function CtaSection() {
  return (
    <section className="bg-paper-warm px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ember shadow-lg shadow-ember/30">
          <LogoMark size={38} />
        </span>
        <h2 className="mt-8 font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
          Ready to know <span className="italic text-ember">how you&apos;re training?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-clay">
          Start with the free plan — every feature included, no card, no account. Your first logged session takes
          about thirty seconds.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="group inline-flex items-center gap-2 rounded-full bg-ember px-8 py-4 text-base font-bold text-white shadow-lg shadow-ember/30 transition-transform hover:scale-[1.03] active:scale-95"
          >
            Start training free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="/#pricing"
            className="inline-flex items-center rounded-full border border-black/15 px-7 py-4 text-base font-semibold text-ink-warm transition-colors hover:bg-black/5"
          >
            See features
          </a>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-clay">No credit card required</p>
      </div>
    </section>
  );
}
