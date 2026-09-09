'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const GUIDES = [
  {
    category: 'Training Foundations',
    readTime: '4 min read',
    title: 'Why “what you did” and “your plan” are two different questions',
    excerpt:
      'Most training frustration comes from mixing a one-off session with the recurring split it belongs to. Keep them separate and progress becomes measurable.',
    anchor: 'Learn why the session and the plan stay separate',
  },
  {
    category: 'Training Methods',
    readTime: '5 min read',
    title: 'Picking a training style that actually fits your week',
    excerpt:
      'Push/Pull/Legs isn’t for everyone. Here’s how to match a split to your availability, recovery and goals — and switch without losing history.',
    anchor: 'Compare the 4 training styles',
  },
  {
    category: 'Consistency',
    readTime: '3 min read',
    title: 'The streak leak: where skipped days quietly break momentum',
    excerpt:
      'Hard sessions are easy to remember. The small, unlogged ones are where streaks die. A few habits that make consistency visible again.',
    anchor: 'Keep your streak alive',
  },
];

export function GuidesSection() {
  return (
    <section
      id="guides"
      className="relative border-t border-[color:var(--foreground)]/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 max-w-3xl lg:mb-20">
          <span className="eyebrow-mono mb-6">Training guides</span>
          <h2 className="mb-6 text-4xl tracking-tight lg:text-6xl">
            Learn to train better,
            <br />
            <span className="text-[color:var(--muted-foreground)]">with consistency in mind.</span>
          </h2>
          <p className="text-lg leading-relaxed text-[color:var(--muted-foreground)]">
            Short, practical guides from the SmartFit team — built around the one idea that matters:
            keep your sessions honest and your plan clear.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 lg:gap-10">
          {GUIDES.map((guide) => (
            <article
              key={guide.title}
              className="group flex flex-col border border-[color:var(--foreground)]/10 p-7 transition-colors hover:border-[color:var(--foreground)]/20 lg:p-8"
            >
              <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="rounded-full bg-[color:var(--foreground)]/5 px-2.5 py-1 font-mono text-xs text-[color:var(--muted-foreground)]">
                  {guide.category}
                </span>
                <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                  {guide.readTime}
                </span>
              </div>
              <h3 className="font-display mb-3 text-xl transition-colors group-hover:text-[color:var(--primary)] lg:text-2xl">
                {guide.title}
              </h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                {guide.excerpt}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)] underline-offset-4 group-hover:underline">
                {guide.anchor}{' '}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-6 py-3 text-sm font-medium text-[color:var(--background)] hover:bg-[color:var(--foreground)]/90"
          >
            Start training free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#features"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--foreground)]/10 px-6 py-3 text-sm font-medium hover:border-[color:var(--foreground)]/30"
          >
            What you can log
          </Link>
          <Link
            href="/#plans"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--foreground)]/10 px-6 py-3 text-sm font-medium hover:border-[color:var(--foreground)]/30"
          >
            4 training styles
          </Link>
        </div>
      </div>
    </section>
  );
}
