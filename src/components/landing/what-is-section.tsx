import { Eyebrow } from './section';

export function WhatIsSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <Eyebrow>What is SmartFit?</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            The free training tracker that separates <span className="text-volt">what you do</span> from{' '}
            <span className="text-volt">how it&apos;s going</span>.
          </h2>
        </div>
        <div className="space-y-5 text-base leading-relaxed text-paper/65 lg:pt-10">
          <p>
            SmartFit is a private fitness tracker that keeps your <strong className="text-paper">activity type</strong> —
            strength, cardio, HIIT, mobility — separate from your <strong className="text-paper">logged sessions</strong>,
            your <strong className="text-paper">recurring plan</strong> and the <strong className="text-paper">goals</strong>{' '}
            you&apos;re chasing.
          </p>
          <p>
            It never needs a wearable or a bank-style account. You log each workout yourself in seconds; everything is
            cached on your device and adds up into 8-week trends, streaks and body metrics. Choose from four proven
            training styles — Push/Pull/Legs, Upper/Lower, Full Body and Cardio — with the split calculated for you.
          </p>
          <p className="text-sm text-paper/45">
            Built for everyone who trains without over-sharing. No subscriptions, no data sold, no trackers.
          </p>
        </div>
      </div>
    </section>
  );
}
