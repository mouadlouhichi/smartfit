'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AnimatedTetrahedron } from './animated-tetrahedron';
import { useReveal } from './use-reveal';

export function CtaSection() {
  const { ref, visible } = useReveal<HTMLDivElement>(0.2);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div
          ref={ref}
          onMouseMove={handleMouseMove}
          className={`reveal relative border border-[color:var(--foreground)] transition-all duration-1000 ${
            visible ? 'opacity-100' : ''
          }`}
          data-state={visible ? 'visible' : 'hidden'}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-10 transition-opacity duration-300"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(0,0,0,0.15), transparent 40%)`,
            }}
          />

          <div className="relative z-10 px-8 py-16 lg:px-16 lg:py-24">
            <div className="flex flex-col items-center justify-between gap-12 lg:flex-row">
              <div className="flex-1">
                <h2 className="font-display mb-8 text-4xl leading-[0.95] tracking-tight lg:text-7xl">
                  Ready to know
                  <br />
                  how you&apos;re training?
                </h2>
                <p className="mb-12 max-w-xl text-xl leading-relaxed text-[color:var(--muted-foreground)]">
                  Start free — every feature included, no card, no account. Your first logged
                  session takes about thirty seconds.
                </p>
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <Link href="/login" className="btn-primary group">
                    Start training free
                    <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link href="/#pricing" className="btn-outline">
                    See features
                  </Link>
                </div>
                <p className="mt-8 font-mono text-sm text-[color:var(--muted-foreground)]">
                  No credit card required
                </p>
              </div>

              <div className="-me-16 hidden h-[500px] w-[500px] items-center justify-center lg:flex">
                <AnimatedTetrahedron />
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 h-32 w-32 border-b border-l border-[color:var(--foreground)]/10" />
          <div className="absolute bottom-0 left-0 h-32 w-32 border-t border-r border-[color:var(--foreground)]/10" />
        </div>
      </div>
    </section>
  );
}
