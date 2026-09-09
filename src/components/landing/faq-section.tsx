'use client';

import Link from 'next/link';

const FAQS = [
  {
    q: 'Is SmartFit free?',
    a: 'Yes — the full training core is free forever with no time limit and no card: unlimited workout logging, plans, goals, streaks, records, achievements and data export. SmartFit Pro ($49.99/year) adds training intelligence on top: adaptive progression targets, a daily readiness score, longer analytics ranges and unlimited routine templates.',
  },
  {
    q: 'What does SmartFit Pro add?',
    a: 'Pro tells you what to do next: every set gets an adaptive target computed from your own history, a daily readiness score tells you when to push or back off, and you unlock quarter/year analytics, unlimited routine templates and watermark-free share cards. Your records, badges and exports stay free either way — Pro never holds your own history hostage. A free 14-day trial needs no card.',
  },
  {
    q: 'Is my data still private on Pro?',
    a: 'Yes — Pro runs on the same local-first architecture. Progression and readiness are computed on your device from data you entered; upgrading changes what the app computes for you, not where your data lives.',
  },
  {
    q: 'Do I need a smartwatch or wearable?',
    a: 'No. SmartFit never pairs with a watch, ring or phone sensor. You log sessions manually, so nothing is misattributed — you decide exactly what counts as a workout.',
  },
  {
    q: 'What training styles does SmartFit support?',
    a: 'Four proven strategies: Push/Pull/Legs (6-day), Upper/Lower (4-day), Full Body 3× for beginners and busy schedules, and Cardio & Conditioning. You can switch plans anytime without losing history.',
  },
  {
    q: 'What activities can I log?',
    a: 'Strength, cardio, HIIT, mobility and sport are built in — running, cycling, swimming, rowing, boxing, yoga and more all map to a type. You can also add custom activity types.',
  },
  {
    q: 'Is my data private?',
    a: 'Completely. Everything is stored locally on your device with no account and no server. We never build advertising profiles or sell your data.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. From Profile you can export a complete, restorable JSON backup plus a CSV of every set for spreadsheets — free on every tier, any time.',
  },
  {
    q: 'How do I delete my data?',
    a: 'You can permanently erase every workout, goal and measurement from Profile in one tap — no account to close, no emails to send.',
  },
  {
    q: 'How is this different from other fitness apps?',
    a: 'SmartFit keeps what a session is (its activity type) strictly separate from the recurring plan it belongs to — so your numbers always reconcile and progress stays honest.',
  },
];

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative overflow-x-clip border-t border-[color:var(--foreground)]/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-12">
        <div className="mb-12 max-w-3xl lg:mb-16">
          <span className="mb-6 block font-mono text-xs tracking-widest text-[color:var(--muted-foreground)] uppercase">
            SmartFit facts
          </span>
          <h2
            id="faq-heading"
            className="font-display text-4xl tracking-tight md:text-5xl lg:text-6xl"
          >
            Frequently asked questions
          </h2>
          <p className="mt-6 text-[color:var(--muted-foreground)]">
            Learn more:{' '}
            <Link
              href="/#integrations"
              className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline"
            >
              activity types
            </Link>{' '}
            ·{' '}
            <Link
              href="/#plans"
              className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline"
            >
              4 training styles
            </Link>{' '}
            ·{' '}
            <Link
              href="/#guides"
              className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline"
            >
              training guides
            </Link>
          </p>
        </div>

        <div className="divide-y divide-[color:var(--foreground)]/10 border-y border-[color:var(--foreground)]/10">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-6 lg:py-8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-medium text-[color:var(--foreground)] marker:content-none lg:text-2xl">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 font-mono text-2xl font-normal text-[color:var(--muted-foreground)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pt-4 text-base leading-relaxed text-[color:var(--muted-foreground)] lg:text-lg">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
