'use client';

import { Shield, Lock, Eye, FileCheck } from 'lucide-react';
import { useReveal } from './use-reveal';

const FEATURES = [
  {
    icon: Shield,
    title: 'Private by default',
    description: 'Your workouts live in local storage on your device. There is no cloud account to breach.',
  },
  {
    icon: Lock,
    title: 'No sensors, no surveillance',
    description: 'SmartFit never pairs with a watch, ring or phone sensor. You decide what counts as a session.',
  },
  {
    icon: Eye,
    title: 'No advertising profiles',
    description: 'We never use your training data to build ad profiles or sell it to third parties. No trackers.',
  },
  {
    icon: FileCheck,
    title: 'Export or delete anytime',
    description: 'Export a complete JSON backup or erase every byte from Profile in one tap.',
  },
];

const BADGES = ['On-device storage', 'No account needed', 'No wearable pairing', 'JSON export', 'No ad profiles'];

export function SecuritySection() {
  const { ref, visible } = useReveal<HTMLElement>(0.1);

  return (
    <section
      id="security"
      ref={ref}
      className="relative overflow-hidden bg-[color:var(--foreground)]/[0.02] py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="reveal" data-state={visible ? 'visible' : 'hidden'}>
            <span className="eyebrow-mono mb-6">Privacy</span>
            <h2 className="mb-8 text-4xl tracking-tight lg:text-6xl">
              Your training,
              <br />
              your business.
            </h2>
            <p className="mb-12 text-xl leading-relaxed text-[color:var(--muted-foreground)]">
              Everything stays on your device. Export and deletion controls live in Profile, and there is no account
              that could ever leak.
            </p>
            <div className="flex flex-wrap gap-3">
              {BADGES.map((cert, index) => (
                <span
                  key={cert}
                  className="reveal border border-[color:var(--foreground)]/10 px-4 py-2 font-mono text-sm transition-all duration-500"
                  data-state={visible ? 'visible' : 'hidden'}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                className="reveal group border border-[color:var(--foreground)]/10 p-6 transition-all duration-500 hover:border-[color:var(--foreground)]/20"
                data-state={visible ? 'visible' : 'hidden-right'}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[color:var(--foreground)]/10 transition-colors duration-300 group-hover:bg-[color:var(--foreground)] group-hover:text-[color:var(--background)]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-medium transition-transform duration-300 group-hover:translate-x-1">
                      {feature.title}
                    </h3>
                    <p className="text-[color:var(--muted-foreground)]">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
