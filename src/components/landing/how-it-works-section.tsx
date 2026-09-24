'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useReveal } from './use-reveal';
import { useI18n } from '@/lib/i18n-context';

const STEP_NUMBERS = ['I', 'II', 'III'];

type Step = {
  number: string;
  title: string;
  description: string;
  snapshotLabel: string;
  /** `valueKey` is set when the value is a word that needs translating. */
  lines: { text: string; value: string; valueKey?: string }[];
  link?: { href: string; anchor: string };
};

const STEPS: Step[] = [
  {
    number: 'I',
    title: 'landing.how.profile.title',
    description: 'landing.how.profile.body',
    snapshotLabel: 'landing.how.profile.snapshot',
    lines: [
      {
        text: 'landing.how.profile.line1',
        valueKey: 'landing.how.profile.value1',
        value: 'Train 5× / week',
      },
      { text: 'landing.how.profile.line2', value: '2' },
      { text: 'landing.how.profile.line3', value: 'kg' },
    ],
    link: { href: '/#how-it-works', anchor: 'None' },
  },
  {
    number: 'II',
    title: 'landing.how.style.title',
    description: 'landing.how.style.body',
    snapshotLabel: 'landing.how.style.snapshot',
    lines: [
      { text: 'landing.how.style.line1', value: 'Full Body 3×' },
      { text: 'landing.how.style.line2', value: '3' },
      { text: 'landing.how.style.line3', valueKey: 'landing.how.style.value3', value: 'built in' },
    ],
    link: { href: '/#plans', anchor: 'landing.guides.methods.anchor' },
  },
  {
    number: 'III',
    title: 'landing.how.log.title',
    description: 'landing.how.log.body',
    snapshotLabel: 'landing.how.log.snapshot',
    lines: [
      { text: 'landing.how.log.line1', value: '55 min' },
      { text: 'landing.how.log.line2', valueKey: 'landing.how.log.value2', value: 'High' },
      { text: 'landing.how.log.line3', value: '~480 kcal' },
    ],
    link: { href: '/dashboard', anchor: 'landing.how.log.anchor' },
  },
];

export function HowItWorksSection() {
  const { t } = useI18n();
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
            style={{ color: 'color-mix(in oklab, currentColor 50%, transparent)' }}
          >
            <span className="h-px w-8 bg-current/30" />
            {t('landing.how.eyebrow')}
          </span>
          <h2
            className="reveal text-4xl tracking-tight lg:text-6xl"
            data-state={visible ? 'visible' : 'hidden'}
          >
            {t('landing.how.title')}
            <br />
            <span style={{ color: 'color-mix(in oklab, currentColor 50%, transparent)' }}>
              {t('landing.how.titleLine2')}
            </span>
          </h2>
          <p
            className="mt-6 max-w-2xl"
            style={{ color: 'color-mix(in oklab, currentColor 60%, transparent)' }}
          >
            {t('landing.how.body.lead')}{' '}
            <span className="underline underline-offset-4">{t('landing.how.body.link')}</span>{' '}
            {t('landing.how.body.tail')}
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
                  activeStep === index
                    ? 'opacity-100'
                    : 'border-current/10 opacity-40 hover:opacity-70'
                }`}
                style={{ borderColor: 'color-mix(in oklab, currentColor 10%, transparent)' }}
              >
                <div className="flex items-start gap-6">
                  <span
                    className="font-display text-3xl"
                    style={{ color: 'color-mix(in oklab, currentColor 30%, transparent)' }}
                  >
                    {STEP_NUMBERS[index]}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-display mb-3 text-2xl transition-transform duration-300 group-hover:translate-x-2 lg:text-3xl">
                      {t(step.title)}
                    </h3>
                    <p
                      className="leading-relaxed"
                      style={{ color: 'color-mix(in oklab, currentColor 60%, transparent)' }}
                    >
                      {t(step.description)}
                    </p>
                    {step.link && (
                      <Link
                        href={step.link.href}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 inline-flex text-xs font-medium underline underline-offset-4 hover:no-underline"
                        style={{ color: 'color-mix(in oklab, currentColor 80%, transparent)' }}
                      >
                        {t(step.link.anchor)} →
                      </Link>
                    )}
                    {activeStep === index && (
                      <div
                        className="mt-4 h-px overflow-hidden"
                        style={{ background: 'color-mix(in oklab, currentColor 20%, transparent)' }}
                      >
                        <div className="progress-bar-anim" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="self-start lg:sticky lg:top-32">
            <div
              className="overflow-hidden border"
              style={{ borderColor: 'color-mix(in oklab, currentColor 10%, transparent)' }}
            >
              <div
                className="flex items-center justify-between border-b px-6 py-4"
                style={{ borderColor: 'color-mix(in oklab, currentColor 10%, transparent)' }}
              >
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-3 w-3 rounded-full"
                      style={{ background: 'color-mix(in oklab, currentColor 20%, transparent)' }}
                    />
                  ))}
                </div>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'color-mix(in oklab, currentColor 40%, transparent)' }}
                >
                  {t(STEPS[activeStep].snapshotLabel)}
                </span>
              </div>
              <div className="flex min-h-[280px] flex-col justify-center gap-6 p-5 min-[400px]:p-8">
                {STEPS[activeStep].lines.map((line, lineIndex) => (
                  <div
                    key={`${activeStep}-${lineIndex}`}
                    className="snapshot-line-reveal flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                    style={{ animationDelay: `${lineIndex * 120}ms` }}
                  >
                    <span
                      className="text-base min-[400px]:text-lg"
                      style={{ color: 'color-mix(in oklab, currentColor 60%, transparent)' }}
                    >
                      {t(line.text)}
                    </span>
                    <span className="font-display text-xl min-[400px]:text-2xl lg:text-3xl">
                      {line.valueKey ? t(line.valueKey) : line.value}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center gap-3 border-t px-6 py-4"
                style={{ borderColor: 'color-mix(in oklab, currentColor 10%, transparent)' }}
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)]" />
                <span
                  className="font-mono text-xs"
                  style={{ color: 'color-mix(in oklab, currentColor 40%, transparent)' }}
                >
                  {t('landing.how.savedPrivately')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
