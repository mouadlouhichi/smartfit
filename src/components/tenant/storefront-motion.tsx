'use client';

import { createContext, useContext, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { ArrowUpRight, Pause, Play } from 'lucide-react';

const MotionContext = createContext({
  running: false,
  reduced: true,
  paused: false,
  toggle: () => {},
});

/** Decorative motion only: no hidden content, scroll hijacking or per-frame React renders. */
export function StorefrontMotion({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const root = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const running = !reduced && !paused && visible;
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    const visibility = () => setVisible(!document.hidden);
    update();
    visibility();
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element || !running || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          target.dataset.inView = String(entry.isIntersecting);
          if (entry.isIntersecting && target.hasAttribute('data-reveal'))
            target.dataset.revealed = 'true';
        }
      },
      { threshold: 0.08 },
    );
    element
      .querySelectorAll('[data-reveal], [data-motion-scene]')
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [running]);
  return (
    <MotionContext.Provider
      value={{ running, reduced, paused, toggle: () => setPaused((value) => !value) }}
    >
      <div {...props} ref={root} data-motion={running ? 'running' : 'paused'}>
        <div className="sf-ambient" aria-hidden="true">
          <i />
          <i />
          <div className="sf-ambient-grid" />
        </div>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export function MotionToggle() {
  const { reduced, paused, toggle } = useContext(MotionContext);
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={reduced}
      aria-pressed={paused || reduced}
      aria-label={
        reduced
          ? 'Animations off: reduced motion'
          : paused
            ? 'Resume animations'
            : 'Pause animations'
      }
      title={
        reduced
          ? 'Your reduced-motion preference is respected'
          : paused
            ? 'Resume animations'
            : 'Pause animations'
      }
      className="hover:bg-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-full border disabled:opacity-50"
    >
      {paused || reduced ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
    </button>
  );
}

/** A fine-pointer tilt and bounded scroll offset, applied only to the cover layer. */
export function useHeroParallax(disabled = false) {
  const ref = useRef<HTMLElement>(null);
  const { running } = useContext(MotionContext);
  useEffect(() => {
    const el = ref.current;
    if (!el || !running || disabled) return;
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0,
      x = 0,
      y = 0;
    const draw = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const scroll = Math.max(-24, Math.min(24, -rect.top * 0.065));
      el.style.setProperty('--sf-shift-x', `${x.toFixed(2)}px`);
      el.style.setProperty('--sf-shift-y', `${(scroll + y).toFixed(2)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (!pointer.matches) return;
      const rect = el.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      y = ((event.clientY - rect.top) / rect.height - 0.5) * 8;
      schedule();
    };
    const reset = () => {
      x = 0;
      y = 0;
      schedule();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', reset);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      el.style.removeProperty('--sf-shift-x');
      el.style.removeProperty('--sf-shift-y');
    };
  }, [running, disabled]);
  return ref;
}

/** Lightweight SVG wireframe echoes the landing sphere without a canvas/render loop. */
export function OrbitArtwork() {
  return (
    <svg className="sf-orbit" viewBox="0 0 500 500" fill="none" aria-hidden="true">
      <g className="sf-orbit-spin" stroke="currentColor" strokeWidth="0.8">
        <circle cx="250" cy="250" r="207" />
        {[25, 55, 85, 115, 145].map((angle) => (
          <ellipse
            key={angle}
            cx="250"
            cy="250"
            rx="207"
            ry="76"
            transform={`rotate(${angle} 250 250)`}
          />
        ))}
        <circle cx="250" cy="250" r="230" strokeDasharray="2 15" />
        <circle cx="250" cy="20" r="5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function TrainingStatement({ labels }: { labels: string[] }) {
  const source = labels.length ? labels : ['Move', 'Train', 'Recover'];
  // Fill even a single-discipline gym's full-width ribbon before duplicating the track.
  const words = Array.from(
    { length: Math.max(12, source.length) },
    (_, index) => source[index % source.length],
  );
  return (
    <section
      className="sf-statement"
      aria-labelledby="training-statement"
      data-motion-scene
      data-reveal
    >
      <div className="sf-statement-orbit">
        <OrbitArtwork />
      </div>
      <div className="relative z-10 px-6 py-12 sm:p-12 lg:p-16">
        <p className="mb-6 font-mono text-[10px] tracking-[.24em] text-white/70 uppercase">
          A little time. A little effort. All you.
        </p>
        <h2
          id="training-statement"
          className="max-w-3xl text-5xl leading-[.95] font-black tracking-[-.055em] sm:text-7xl lg:text-8xl"
        >
          Make room
          <br />
          for <span className="sf-outline-word">more.</span>
        </h2>
        <div className="mt-8 flex max-w-2xl flex-wrap items-end justify-between gap-6">
          <p className="max-w-xs text-sm leading-relaxed text-white/70">
            More movement. More moments for yourself. Your next session starts here.
          </p>
          <a
            href="#timetable"
            className="sf-statement-cta inline-flex items-center gap-5 rounded-full px-6 py-3 text-sm font-semibold"
          >
            Find your next session <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
      <div className="sf-ribbon" aria-hidden="true">
        <div className="sf-ribbon-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="sf-ribbon-group">
              {words.map((word, index) => (
                <span key={`${word}-${index}`}>
                  {word}
                  <span className="sf-ribbon-star">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
