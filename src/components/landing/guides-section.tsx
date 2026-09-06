import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Eyebrow, Section } from './section';

const GUIDES = [
  {
    tag: 'Foundations',
    read: '4 min read',
    title: 'Why “what you did” and “your plan” are two different questions',
    body: 'Most training frustration comes from mixing a one-off session with the recurring split it belongs to. Keep them separate and progress becomes measurable.',
  },
  {
    tag: 'Training methods',
    read: '5 min read',
    title: 'Picking a training style that actually fits your week',
    body: 'Push/Pull/Legs isn’t for everyone. Here’s how to match a split to your availability, recovery and goals — and switch without losing history.',
  },
  {
    tag: 'Consistency',
    read: '3 min read',
    title: 'The streak leak: where skipped days quietly break momentum',
    body: 'Hard sessions are easy to remember. The small, unlogged ones are where streaks die. A few habits that make consistency visible again.',
  },
];

export function GuidesSection() {
  return (
    <Section id="guides">
      <Eyebrow>Training guides</Eyebrow>
      <h2 className="mt-3 max-w-2xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
        Learn to train better, <span className="italic text-ember">with consistency in mind.</span>
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-clay">
        Short, practical guides from the SmartFit team. Built around the one idea that matters: keep your sessions
        honest and your plan clear.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {GUIDES.map((g) => (
          <div
            key={g.title}
            className="group flex flex-col rounded-3xl border border-black/10 bg-white p-7 transition-shadow hover:shadow-lg hover:shadow-black/5"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
              <span className="text-ember">{g.tag}</span>
              <span className="text-clay">{g.read}</span>
            </div>
            <h3 className="mt-4 font-display text-xl font-bold leading-snug text-ink-warm">{g.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-clay">{g.body}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-ember">
              Read guide <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-clay">
        SmartFit is a tracker, not a medical device — train within your limits.{' '}
        <Link href="/#features" className="font-semibold text-ember hover:underline">
          See what you can log →
        </Link>
      </p>
    </Section>
  );
}
