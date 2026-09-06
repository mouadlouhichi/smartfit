import { SectionHeading } from './section';

const FAQS = [
  {
    q: 'Do I need a smartwatch or wearable?',
    a: 'No. SmartFit is built around manual logging — you decide what counts as a session, with nothing depending on a device on your wrist.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Entirely on your device. There is no account and no server receiving your workouts. The web app uses localStorage and the mobile app uses AsyncStorage. Export or erase everything with one tap.',
  },
  {
    q: 'What training styles are included?',
    a: 'Push/Pull/Legs (6-day), Upper/Lower (4-day), Full Body 3× for beginners, and a Cardio & Conditioning plan. You can also schedule any custom session.',
  },
  {
    q: 'How is this different from a normal fitness app?',
    a: 'SmartFit keeps what a session is (its activity type) strictly separate from your recurring plan, your goals and your body trends — so the numbers always reconcile and progress is honest.',
  },
  {
    q: 'Is SmartFit really free?',
    a: 'Yes. Every feature is free. There is no subscription, no trial to remember and no premium tier.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-white/10 bg-ink-2">
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-6">
        <SectionHeading eyebrow="FAQ" className="mx-auto text-center">
          Questions, <span className="text-volt">answered.</span>
        </SectionHeading>
        <div className="mt-12 grid gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-white/10 bg-ink-card p-6 open:border-volt/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold marker:hidden [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-2xl font-light text-volt transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-paper/60">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
