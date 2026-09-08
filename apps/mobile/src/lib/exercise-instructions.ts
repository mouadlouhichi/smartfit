import { exerciseInstructionsUrl, matchExercise, type ExerciseUpstream } from '@smartfit/core';

/**
 * Lazy loader for the upstream per-exercise JSON (step-by-step
 * instructions, level, muscles) — the same open dataset that provides the
 * demo frames. Results are cached by catalog id for the session, with
 * failed lookups dropped so they can be retried.
 */

const cache = new Map<string, Promise<ExerciseUpstream>>();

export function loadExerciseUpstream(name: string): Promise<ExerciseUpstream> | null {
  const entry = matchExercise(name);
  if (!entry) return null;
  const id = entry.id;

  let pending = cache.get(id);
  if (!pending) {
    pending = fetch(exerciseInstructionsUrl(entry))
      .then((r) => {
        if (!r.ok) throw new Error(`Upstream responded ${r.status}`);
        return r.json() as Promise<ExerciseUpstream>;
      })
      .catch((err) => {
        cache.delete(id);
        throw err;
      });
    cache.set(id, pending);
  }
  return pending;
}
