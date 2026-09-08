'use client';

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exerciseGifUrl, exerciseImages, matchExercise } from '@smartfit/core';
import { useExtendedCatalog } from '@/lib/use-extended-catalog';

/**
 * Demonstration image for a logged exercise.
 *
 * Preferred source: the catalog's curated ExerciseDB-style animated GIFs —
 * looping illustrations with the target muscle highlighted in red, the
 * demo style people know from workout idea boards. The default `thumb`
 * variant is a 128px animated WebP (~18KB) that stays cheap even in long
 * grids; `variant="full"` requests the full-size GIF for the how-to dialog.
 *
 * Exercises without a curated GIF — or when the GIF CDN fails to load —
 * fall back to the open free-exercise-db dataset's two frames per movement
 * (start and end position), crossfaded for a GIF-like loop (see
 * `exercise-demo-*` in globals.css). Unknown names keep their row intact
 * with a neutral dumbbell tile.
 */
export function ExerciseImage({
  name,
  className,
  animated = true,
  animateOnHover = false,
  variant = 'thumb',
}: {
  /** Free-text exercise name from a workout log — matched against the catalog. */
  name: string;
  className?: string;
  /** Crossfade the fallback photo frames; set false for static (e.g. long lists). */
  animated?: boolean;
  /**
   * Animate the fallback photo pair only while the tile is hovered — the
   * second frame is not even fetched until then, keeping large browse grids
   * light. GIF-backed tiles always loop; that is the point of them.
   */
  animateOnHover?: boolean;
  /** GIF size: light animated WebP thumb for tiles, full GIF for the dialog. */
  variant?: 'thumb' | 'full';
}) {
  // Extended (runtime-loaded) entries can appear after mount — this
  // re-renders (and re-matches) once the catalog lands.
  useExtendedCatalog();
  const entry = matchExercise(name);
  const [hovered, setHovered] = useState(false);
  /** Id of the entry whose GIF failed to load — falls back to its photos. */
  const [failedGifFor, setFailedGifFor] = useState<string | null>(null);

  const gif = entry && failedGifFor !== entry.id ? exerciseGifUrl(entry, variant) : null;

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

  if (gif) {
    return (
      <span
        className={cn('bg-secondary relative shrink-0 overflow-hidden', className)}
        role="img"
        aria-label={`${entry.name} demonstration`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote demo gif, not part of the build */}
        <img
          src={gif}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedGifFor(entry.id)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  // Extended catalog entries have no photo frames — keep the dumbbell tile.
  const frames = exerciseImages(entry);
  if (!frames) {
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

  const [start, end] = frames;
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
