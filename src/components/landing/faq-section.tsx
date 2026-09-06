import { SectionHeading, Section } from './section';

const FAQS = [
  {
    q: 'Is SmartFit free?',
    a: 'Yes — every feature is free with no time limit. There is no premium tier, no trial that runs out, and no card required. SmartFit is private and local-first, so there is nothing to upsell.',
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
    a: 'Yes. From Profile you can export a complete, restorable JSON backup any time.',
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
    <Section id="faq" alt>
      <SectionHeading eyebrow="SmartFit facts" className="mx-auto text-center">
        Frequently asked <span className="italic text-ember">questions</span>
      </SectionHeading>
      <div className="mx-auto mt-12 grid max-w-3xl gap-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-black/10 bg-paper-warm p-6 open:border-ember/40 open:bg-white"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold text-ink-warm marker:hidden [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember/10 text-2xl font-light text-ember transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-clay">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
