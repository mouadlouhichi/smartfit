import { Eyebrow } from './section';

export function WhatIsSection() {
  return (
    <section className="bg-paper-warm">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
        <div>
          <Eyebrow>What is SmartFit?</Eyebrow>
          <h2 className="mt-3 font-display-tight text-3xl font-extrabold text-ink-warm sm:text-4xl">
            The free workout tracker that keeps your training honest.
          </h2>
        </div>
        <div className="space-y-5 text-lg leading-relaxed text-clay">
          <p>
            SmartFit is a private fitness tracker that separates what a session{' '}
            <strong className="text-ink-warm">is</strong> — strength, cardio, HIIT, mobility — from the recurring plan
            it <strong className="text-ink-warm">belongs to</strong>. It supports 4 proven training strategies:
            Push/Pull/Legs, Upper/Lower, Full Body 3× and Cardio &amp; Conditioning.
          </p>
          <p>
            SmartFit does not pair with a watch or ring; you log sessions manually so nothing is misattributed. Your
            data lives entirely on your device — there&apos;s no account and no cloud watching you. Set your split,
            schedule your week, and watch streaks, goals and body trends build themselves.
          </p>
          <p className="text-base">
            Pick a plan → schedule your week → log as you go. That&apos;s the whole method.
          </p>
        </div>
      </div>
    </section>
  );
}
