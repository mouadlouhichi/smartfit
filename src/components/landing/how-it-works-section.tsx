'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useReveal } from './use-reveal';

const STEP_NUMBERS = ['I', 'II', 'III'];

type Step = {
  number: string;
  title: string;
  description: string;
  snapshotLabel: string;
  lines: { text: string; value: string }[];
  link?: { href: string; anchor: string };
};

const STEPS: Step[] = [
  {
    number: 'I',
    title: 'Tell us about your training',
    description:
      'Pick a goal, your weekly availability and rest days. It takes about a minute, and you can change everything later.',
    snapshotLabel: 'Your profile',
    lines: [
      { text: 'Goal', value: 'Train 5× / week' },
      { text: 'Rest days', value: '2' },
      { text: 'Weight unit', value: 'kg' },
    ],
  },
  {
    number: 'II',
    title: 'Pick a training style',
    description:
      'SmartFit lays out your weekly split — push/pull/legs, upper/lower, full body or cardio focus. Switch strategies anytime without losing history.',
    snapshotLabel: 'Chosen split',
    lines: [
      { text: 'Strategy', value: 'Full Body 3×' },
      { text: 'Sessions / week', value: '3' },
      { text: 'Active rest', value: 'built in' },
    ],
    link: { href: '/#plans', anchor: 'Compare the 4 training styles' },
  },
  {
    number: 'III',
    title: 'Log sessions as they happen',
    description:
      'Add a workout in seconds and tag the activity type. Your plan, streaks, goals and trends update instantly — all on your device.',
    snapshotLabel: 'Latest session',
    lines: [
      { text: 'Push — chest & shoulders', value: '55 min' },
      { text: 'Intensity', value: 'High' },
      { text: 'Calories', value: '~480 kcal' },
    ],
    link: { href: '/dashboard', anchor: 'See how fast logging works' },
  },
];

export function HowItWorksSection() {
  const { ref, visible } = useReveal<HTMLElement>(0.1);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveStep((prev) => (prev + 1) % STEPS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative overflow-hidden bg-[color:var(--foreground)] py-24 text-[color:var(--background)] lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <span
            className="mb-6 inline-flex items-center gap-3 font-mono text-sm"
            style={{ color: 'rgba(248,250,247,0.5)' }}
          >
            <span className="h-px w-8 bg-white/30" />
            Three steps
          </span>
          <h2
            className="reveal text-4xl tracking-tight lg:text-6xl"
            data-state={visible ? 'visible' : 'hidden'}
          >
            Three steps.
            <br />
            <span style={{ color: 'rgba(248,250,247,0.5)' }}>A stronger week ahead.</span>
          </h2>
          <p className="mt-6 max-w-2xl" style={{ color: 'rgba(248,250,247,0.6)' }}>
            Start with a <span className="underline underline-offset-4">free private training tracker</span> that
            needs no wearable. See why the session and the plan stay separate, and how your week updates itself.
          </p>
        </div>

        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="space-y-0">
            {STEPS.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`group w-full border-b py-8 text-start transition-all duration-500 ${
                  activeStep === index ? 'opacity-100' : 'border-white/10 opacity-40 hover:opacity-70'
                }`}
                style={{ borderColor: 'rgba(248,250,247,0.1)' }}
              >
                <div className="flex items-start gap-6">
                  <span className="font-display text-3xl" style={{ color: 'rgba(248,250,247,0.3)' }}>
                    {STEP_NUMBERS[index]}
                  </span>
                  <div className="flex-1">
                    <h3 className="mb-3 font-display text-2xl transition-transform duration-300 group-hover:translate-x-2 lg:text-3xl">
                      {step.title}
                    </h3>
                    <p className="leading-relaxed" style={{ color: 'rgba(248,250,247,0.6)' }}>
                      {step.description}
                    </p>
                    {step.link && (
                      <Link
                        href={step.link.href}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 inline-flex text-xs font-medium underline underline-offset-4 hover:no-underline"
                        style={{ color: 'rgba(248,250,247,0.8)' }}
                      >
                        {step.link.anchor} →
                      </Link>
                    )}
                    {activeStep === index && (
                      <div className="mt-4 h-px overflow-hidden" style={{ background: 'rgba(248,250,247,0.2)' }}>
                        <div className="progress-bar-anim" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="self-start lg:sticky lg:top-32">
            <div className="overflow-hidden border" style={{ borderColor: 'rgba(248,250,247,0.1)' }}>
              <div
                className="flex items-center justify-between border-b px-6 py-4"
                style={{ borderColor: 'rgba(248,250,247,0.1)' }}
              >
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-3 w-3 rounded-full" style={{ background: 'rgba(248,250,247,0.2)' }} />
                  ))}
                </div>
                <span className="font-mono text-xs" style={{ color: 'rgba(248,250,247,0.4)' }}>
                  {STEPS[activeStep].snapshotLabel}
                </span>
              </div>
              <div className="flex min-h-[280px] flex-col justify-center gap-6 p-8">
                {STEPS[activeStep].lines.map((line, lineIndex) => (
                  <div
                    key={`${activeStep}-${lineIndex}`}
                    className="snapshot-line-reveal flex items-baseline justify-between"
                    style={{ animationDelay: `${lineIndex * 120}ms` }}
                  >
                    <span className="text-lg" style={{ color: 'rgba(248,250,247,0.6)' }}>
                      {line.text}
                    </span>
                    <span className="font-display text-2xl lg:text-3xl">{line.value}</span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center gap-3 border-t px-6 py-4"
                style={{ borderColor: 'rgba(248,250,247,0.1)' }}
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                <span className="font-mono text-xs" style={{ color: 'rgba(248,250,247,0.4)' }}>
                  Saved on-device
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
