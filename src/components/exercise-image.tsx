'use client';

import { useMemo, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exerciseImages, matchExercise } from '@smartfit/core';

/**
 * Demonstration image for a logged exercise.
 *
 * The shared catalog maps free-text exercise names to the open
 * free-exercise-db dataset, which provides two frames per movement (start
 * and end position). Stacking them and crossfading (see `exercise-demo-*`
 * in globals.css) produces the looping, GIF-style preview users expect
 * next to a logged exercise. Unknown names keep their row intact with a
 * neutral dumbbell tile.
 */
export function ExerciseImage({
  name,
  className,
  animated = true,
  animateOnHover = false,
}: {
  /** Free-text exercise name from a workout log — matched against the catalog. */
  name: string;
  className?: string;
  /** Crossfade the two frames; set false for static (e.g. long lists). */
  animated?: boolean;
  /**
   * Animate only while the tile is hovered — the second frame is not even
   * fetched until then, keeping large browse grids light.
   */
  animateOnHover?: boolean;
}) {
  const entry = useMemo(() => matchExercise(name), [name]);
  const [hovered, setHovered] = useState(false);

  if (!entry) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'bg-secondary text-muted-foreground flex shrink-0 items-center justify-center',
          className,
        )}
      >
        <Dumbbell className="h-1/2 w-1/2" strokeWidth={1.75} />
      </span>
    );
  }

  const [start, end] = exerciseImages(entry);
  const loop = animateOnHover ? hovered : animated;

  return (
    <span
      className={cn('bg-secondary relative shrink-0 overflow-hidden', className)}
      role="img"
      aria-label={`${entry.name} demonstration`}
      onMouseEnter={animateOnHover ? () => setHovered(true) : undefined}
      onMouseLeave={animateOnHover ? () => setHovered(false) : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote demo photos, not part of the build */}
      <img
        src={start}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('absolute inset-0 h-full w-full object-contain', loop && 'exercise-demo-a')}
      />
      {loop && (
        /* eslint-disable-next-line @next/next/no-img-element -- remote demo photos, not part of the build */
        <img
          src={end}
          alt=""
          loading="lazy"
          decoding="async"
          className="exercise-demo-b absolute inset-0 h-full w-full object-contain"
        />
      )}
    </span>
  );
}
