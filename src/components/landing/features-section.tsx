'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useReveal } from './use-reveal';

const FEATURE_VISUALS = ['logs', 'plan', 'reconcile', 'shield'] as const;
type FeatureVisual = (typeof FEATURE_VISUALS)[number];

function LogsVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      <defs>
        <clipPath id="logsClip">
          <rect x="30" y="20" width="140" height="120" rx="4" />
        </clipPath>
      </defs>
      <rect x="30" y="20" width="140" height="120" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <g clipPath="url(#logsClip)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x="40" y={35 + i * 16} width="120" height="10" rx="2" fill="currentColor" opacity="0.15">
            <animate attributeName="opacity" values="0.15;0.8;0.15" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
            <animate attributeName="width" values="20;120;20" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>
      <circle cx="100" cy="155" r="3" fill="currentColor" opacity="0.3">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function PlanVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      <circle cx="100" cy="80" r="12" fill="currentColor">
        <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
      </circle>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * 60 * Math.PI) / 180;
        const radius = 50;
        const nodeX = (100 + Math.cos(angle) * radius).toFixed(3);
        const nodeY = (80 + Math.sin(angle) * radius).toFixed(3);
        return (
          <g key={i}>
            <line x1="100" y1="80" x2={nodeX} y2={nodeY} stroke="currentColor" strokeWidth="1" opacity="0.3">
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </line>
            <circle cx={nodeX} cy={nodeY} r="6" fill="none" stroke="currentColor" strokeWidth="2">
              <animate attributeName="r" values="6;8;6" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
      <circle cx="100" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="20;60" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function ReconcileVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      <g>
        <rect x="30" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="55" y="85" textAnchor="middle" fontSize="16" fontFamily="monospace" fill="currentColor">LOG</text>
        <circle cx="55" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
      <g>
        <rect x="120" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="145" y="85" textAnchor="middle" fontSize="14" fontFamily="monospace" fill="currentColor">PLAN</text>
        <circle cx="145" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
      <line x1="80" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
        <animate attributeName="stroke-dashoffset" values="0;-8" dur="0.5s" repeatCount="indefinite" />
      </line>
      <circle r="4" fill="currentColor">
        <animateMotion dur="1.5s" repeatCount="indefinite">
          <mpath href="#reconcilePath" />
        </animateMotion>
      </circle>
      <path id="reconcilePath" d="M 80 80 L 120 80" fill="none" />
    </svg>
  );
}

function ShieldVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      <path d="M 100 20 L 150 40 L 150 90 Q 150 130 100 145 Q 50 130 50 90 L 50 40 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M 100 35 L 135 50 L 135 85 Q 135 115 100 128 Q 65 115 65 85 L 65 50 Z" fill="currentColor" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
      </path>
      <rect x="85" y="70" width="30" height="25" rx="3" fill="currentColor" />
      <path d="M 90 70 L 90 60 Q 90 50 100 50 Q 110 50 110 60 L 110 70" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="80" r="4" fill="white" />
      <rect x="98" y="82" width="4" height="8" fill="white" />
    </svg>
  );
}

function AnimatedVisual({ type }: { type: FeatureVisual }) {
  switch (type) {
    case 'logs':
      return <LogsVisual />;
    case 'plan':
      return <PlanVisual />;
    case 'reconcile':
      return <ReconcileVisual />;
    case 'shield':
      return <ShieldVisual />;
    default:
      return <LogsVisual />;
  }
}

type Feature = {
  number: string;
  title: string;
  description: string;
  visual: FeatureVisual;
  link?: { href: string; anchor: string };
};

const FEATURES: Feature[] = [
  {
    number: '01',
    title: 'Know what it is',
    description:
      'Every logged session is tagged to an activity type — strength, cardio, HIIT, mobility — so the workout stays separate from the plan behind it.',
    visual: 'logs',
    link: { href: '/#how-it-works', anchor: 'Why the session and the plan stay separate' },
  },
  {
    number: '02',
    title: 'Pick a style that fits you',
    description:
      'Choose from four proven training strategies. SmartFit lays out your weekly split automatically — push/pull/legs, upper/lower, full body or cardio focus.',
    visual: 'plan',
    link: { href: '/#plans', anchor: 'Compare 4 training styles' },
  },
  {
    number: '03',
    title: 'See it all reconcile',
    description:
      'Volume, calories, distance and streaks reconcile across every view. Logged sessions update your plan, goals and trends together — nothing drifts.',
    visual: 'reconcile',
    link: { href: '/dashboard', anchor: 'See how the views stay in sync' },
  },
  {
    number: '04',
    title: 'Nothing leaves your device',
    description:
      'There is no account and no server. Delete a session and its effect reverses cleanly. Export or erase everything from Profile in one tap.',
    visual: 'shield',
    link: { href: '/#security', anchor: 'How on-device privacy works' },
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      className={`reveal group relative ${visible ? 'opacity-100' : ''}`}
      data-state={visible ? 'visible' : 'hidden'}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col gap-8 border-b border-[color:var(--foreground)]/10 py-12 lg:flex-row lg:gap-16 lg:py-20">
        <div className="shrink-0">
          <span className="font-mono text-sm text-[color:var(--muted-foreground)]">{feature.number}</span>
        </div>
        <div className="grid flex-1 items-center gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-3xl transition-transform duration-500 group-hover:translate-x-2 lg:text-4xl">
              {feature.title}
            </h3>
            <p className="text-lg leading-relaxed text-[color:var(--muted-foreground)]">{feature.description}</p>
            {feature.link && (
              <Link
                href={feature.link.href}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)] underline-offset-4 hover:underline"
              >
                {feature.link.anchor} →
              </Link>
            )}
          </div>
          <div className="flex justify-center text-[color:var(--foreground)] lg:justify-end">
            <div className="h-40 w-48">
              <AnimatedVisual type={feature.visual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const { ref, visible } = useReveal<HTMLElement>(0.1);
  return (
    <section id="features" ref={ref} className="relative overflow-x-clip py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <span className="eyebrow-mono mb-6">Training styles &amp; capabilities</span>
          <h2
            className="reveal text-4xl tracking-tight lg:text-6xl"
            data-state={visible ? 'visible' : 'hidden'}
          >
            Log your training.
            <br />
            <span className="text-[color:var(--muted-foreground)]">Track it by plan or session.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-[color:var(--muted-foreground)]">
            SmartFit is a{' '}
            <Link href="/" className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline">
              free private fitness tracker
            </Link>{' '}
            built for consistency — it keeps your activity types separate from your recurring plan and reconciles
            them automatically.
          </p>
        </div>

        {FEATURES.map((feature, index) => (
          <FeatureCard key={feature.number} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}
