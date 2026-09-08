'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ExerciseImage } from './exercise-image';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_MUSCLE_LABELS,
  exerciseInstructionsUrl,
  matchExercise,
  type ExerciseUpstream,
} from '@smartfit/core';

/**
 * "How do I do this?" for any catalog exercise.
 *
 * Step-by-step instructions (plus level & mechanic) are fetched lazily from
 * the same open dataset that provides the demo frames, then cached for the
 * session — unknown custom names simply never open this dialog.
 */

const cache = new Map<string, Promise<ExerciseUpstream>>();

function loadUpstream(id: string, url: string): Promise<ExerciseUpstream> {
  let pending = cache.get(id);
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Upstream responded ${r.status}`);
        return r.json() as Promise<ExerciseUpstream>;
      })
      .catch((err) => {
        cache.delete(id); // allow a retry next time
        throw err;
      });
    cache.set(id, pending);
  }
  return pending;
}

export function useExerciseUpstream(id: string | null, url: string | null) {
  const [data, setData] = useState<ExerciseUpstream | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || !url) return;
    let cancelled = false;
    setError(false);
    setData(null);
    loadUpstream(id, url)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id, url]);

  return {
    data,
    error,
    retry: () => {
      if (!id || !url) return;
      setError(false);
      setData(null);
      loadUpstream(id, url)
        .then((d) => setData(d))
        .catch(() => setError(true));
    },
  };
}

export function ExerciseDetailDialog({
  name,
  open,
  onOpenChange,
}: {
  /** Catalog exercise name (already resolved — call sites use matchExercise). */
  name: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entry = name ? matchExercise(name) : null;
  const { data, error, retry } = useExerciseUpstream(
    entry && open ? entry.id : null,
    entry ? exerciseInstructionsUrl(entry) : null,
  );

  const steps = data?.instructions ?? [];
  const level = typeof data?.level === 'string' ? data.level : null;
  const mechanic = typeof data?.mechanic === 'string' ? data.mechanic : null;

  return (
    <Dialog open={open && !!entry} onOpenChange={onOpenChange}>
      <DialogContent>
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>{entry.name}</DialogTitle>
              <DialogDescription>
                {EXERCISE_MUSCLE_LABELS[entry.muscles[0]]} ·{' '}
                {EXERCISE_EQUIPMENT_LABELS[entry.equipment]}
                {level ? ` · ${level}` : ''}
                {mechanic ? ` · ${mechanic}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              <ExerciseImage name={entry.name} className="h-44 w-44 rounded-xl" variant="full" />

              <div className="flex flex-wrap justify-center gap-1.5">
                {entry.muscles.map((m, i) => (
                  <Badge key={m} variant={i === 0 ? 'default' : 'secondary'}>
                    {EXERCISE_MUSCLE_LABELS[m]}
                  </Badge>
                ))}
                <Badge variant="outline">{EXERCISE_EQUIPMENT_LABELS[entry.equipment]}</Badge>
              </div>
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">How to do it</h3>
              {steps.length > 0 && (
                <ol className="grid gap-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="bg-accent text-accent-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {i + 1}
                      </span>
                      <p className="text-foreground/90 text-sm leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              )}
              {!data && !error && (
                <p className="text-muted-foreground animate-pulse-soft text-sm">
                  Loading instructions…
                </p>
              )}
              {error && (
                <div className="grid gap-2">
                  <p className="text-muted-foreground text-sm">
                    Couldn’t load the instructions — check your connection.
                  </p>
                  <button
                    type="button"
                    onClick={retry}
                    className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
              {data && steps.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No step-by-step guide recorded for this exercise.
                </p>
              )}
            </div>

            <p className="text-muted-foreground text-center text-xs">
              Demo GIFs: ExerciseDB artwork mirrored by{' '}
              <a
                href="https://github.com/JahelCuadrado/ExerciseGymGifsDB"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                ExerciseGymGifsDB
              </a>{' '}
              (personal use). Steps &amp; photo fallbacks from{' '}
              <a
                href="https://github.com/yuhonas/free-exercise-db"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                free-exercise-db
              </a>{' '}
              (Unlicense).
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
