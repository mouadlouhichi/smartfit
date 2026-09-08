import { useEffect, useMemo, useState } from 'react';
import {
  allExercises,
  loadExtendedCatalog,
  subscribeExtendedCatalog,
  type ExerciseCatalogEntry,
} from '@smartfit/core';

/**
 * Subscribes to the runtime-loaded extended exercise catalog — the full
 * 1,323-exercise ExerciseGymGifsDB library — and kicks off its fetch on
 * first use. Returns a version counter that changes whenever the catalog
 * updates, so callers re-render (and re-match/re-search) once it lands.
 *
 * Until the fetch resolves (or if it fails, e.g. offline), the app runs on
 * the curated 103-exercise catalog bundled with @smartfit/core.
 */
export function useExtendedCatalog(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeExtendedCatalog(() => {
      if (alive) setVersion((v) => v + 1);
    });
    loadExtendedCatalog().catch((error: unknown) => {
      if (alive) console.warn('Extended exercise catalog unavailable, staying on curated', error);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return version;
}

/**
 * The merged catalog — curated entries plus whatever the extended loader has
 * registered — as a stable array that updates when the extended catalog does.
 * Use it as a memo dependency wherever lists, counts or searches are derived.
 */
export function useAllExercises(): ExerciseCatalogEntry[] {
  const version = useExtendedCatalog();
  // The `version >= 0` guard references the counter so the array refreshes
  // whenever the extended catalog updates.
  return useMemo(() => (version >= 0 ? allExercises() : []), [version]);
}
