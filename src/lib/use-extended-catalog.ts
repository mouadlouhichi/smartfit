'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  allExercises,
  extendedExerciseCount,
  loadExtendedCatalog,
  subscribeExtendedCatalog,
  type ExerciseCatalogEntry,
} from '@smartfit/core';

/**
 * Subscribes to the runtime-loaded extended exercise catalog — the full
 * 1,323-exercise ExerciseGymGifsDB library — and kicks off its fetch on
 * first use. Returns a counter that changes whenever the catalog updates, so
 * callers re-render (and re-match/re-search) once it lands.
 *
 * Until the fetch resolves (or if it fails, e.g. offline), the app runs on
 * the curated 103-exercise catalog bundled with @smartfit/core.
 */
export function useExtendedCatalog(): number {
  const count = useSyncExternalStore(subscribeExtendedCatalog, extendedExerciseCount, () => 0);
  useEffect(() => {
    loadExtendedCatalog().catch((error: unknown) => {
      console.warn('Extended exercise catalog unavailable, staying on curated', error);
    });
  }, []);
  return count;
}

/**
 * The merged catalog — curated entries plus whatever the extended loader has
 * registered — as a stable array that updates when the extended catalog does.
 * Use it as a memo dependency wherever lists, counts or searches are derived.
 */
export function useAllExercises(): ExerciseCatalogEntry[] {
  const count = useExtendedCatalog();
  // The `count >= 0` guard references the snapshot so the array refreshes
  // whenever the extended catalog updates.
  return useMemo(() => (count >= 0 ? allExercises() : []), [count]);
}
