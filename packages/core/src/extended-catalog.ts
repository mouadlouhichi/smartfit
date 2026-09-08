/**
 * Runtime-loaded extension of the exercise catalog.
 *
 * The curated catalog in ./exercises.ts bundles the 103 most useful
 * movements so the app works offline. On top of that, the full
 * ExerciseGymGifsDB library (1,323 exercises — names, equipment, category
 * and animated demos) is fetched once at runtime from the same pinned jsDelivr
 * release that serves the gifs. Items are mapped onto our taxonomy,
 * deduplicated against the curated catalog, and registered via
 * {@link setExtendedExerciseEntries} so matching and search cover everything.
 *
 * If the fetch fails (offline, CDN hiccup) the app simply keeps running on
 * the curated catalog and the load can be retried later.
 */
import {
  EXERCISES,
  EXERCISE_GIF_BASE,
  setExtendedExerciseEntries,
  type ExerciseCatalogEntry,
  type ExerciseEquipment,
  type ExerciseGroup,
  type ExerciseMuscle,
} from './exercises';

/** One item of the gif database's `api/en/search.json` file. */
export interface GifDbItem {
  /** `"muscle/slug"` identifier used by the database. */
  id?: string;
  slug: string;
  name: string;
  muscle: string;
  bodyPart?: string;
  equipment?: string;
  category?: string;
  secondaryMuscles?: string[];
}

/** Shape of the whole `search.json` file (only what we consume). */
interface GifDbSearchFile {
  count?: number;
  items?: GifDbItem[];
}

/** Their muscle taxonomy → our muscle taxonomy. */
const MUSCLE_TO_OURS: Record<string, ExerciseMuscle> = {
  pectorals: 'chest',
  lats: 'lats',
  traps: 'traps',
  'upper-back': 'middle back',
  spine: 'lower back',
  'levator-scapulae': 'middle back',
  delts: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abductors: 'glutes',
  adductors: 'quadriceps',
  abs: 'abdominals',
  'serratus-anterior': 'abdominals',
};

/** Their equipment taxonomy → our equipment taxonomy. */
const EQUIPMENT_TO_OURS: Record<string, ExerciseEquipment> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  lever: 'machine',
  smith: 'machine',
  sled: 'machine',
  bodyweight: 'body',
  band: 'band',
  kettlebell: 'kettlebell',
  'ez-bar': 'ez-bar',
};

/** Lowercase, strip punctuation, collapse whitespace — mirrors the core matcher. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Their muscle + category → our exercise group. */
function groupFor(item: GifDbItem): ExerciseGroup {
  if (item.category === 'stretching') return 'mobility';
  if (item.category === 'cardio' || item.category === 'plyometrics') return 'conditioning';
  switch (item.muscle) {
    case 'pectorals':
      return 'chest';
    case 'lats':
    case 'traps':
    case 'upper-back':
    case 'spine':
    case 'levator-scapulae':
      return 'back';
    case 'delts':
      return 'shoulders';
    case 'biceps':
    case 'triceps':
    case 'forearms':
      return 'arms';
    case 'quads':
    case 'hamstrings':
    case 'glutes':
    case 'calves':
    case 'abductors':
    case 'adductors':
      return 'legs';
    case 'abs':
    case 'serratus-anterior':
      return 'core';
    case 'cardio':
      return 'conditioning';
    default:
      return 'conditioning';
  }
}

/** Map one gif-database item onto our catalog shape. */
function toEntry(item: GifDbItem): ExerciseCatalogEntry {
  const primary = MUSCLE_TO_OURS[item.muscle] ?? 'quadriceps';
  const muscles: ExerciseMuscle[] = [primary];
  for (const secondary of item.secondaryMuscles ?? []) {
    const mapped = secondary === 'cardio' ? undefined : MUSCLE_TO_OURS[secondary];
    if (mapped && mapped !== primary && !muscles.includes(mapped)) muscles.push(mapped);
  }
  return {
    id: item.id ?? `${item.muscle}/${item.slug}`,
    name: item.name,
    muscles,
    equipment: EQUIPMENT_TO_OURS[item.equipment ?? ''] ?? 'other',
    group: groupFor(item),
    gif: { muscle: item.muscle, slug: item.slug },
    extended: true,
  };
}

// Dedupe anchors against the curated catalog: an item is skipped when the
// curated entry already shows its gif, or when its (normalized) name is
// already a curated entry name or alias — so "Barbell Curl" is never added twice.
const curatedGifKeys = new Set(
  EXERCISES.filter((entry) => entry.gif).map((entry) => `${entry.gif!.muscle}/${entry.gif!.slug}`),
);
const curatedNames = new Set<string>();
for (const entry of EXERCISES) {
  curatedNames.add(normalizeName(entry.name));
  for (const alias of entry.aliases ?? []) curatedNames.add(normalizeName(alias));
}

let extendedList: ExerciseCatalogEntry[] = [];
let loaded = false;
let loading: Promise<ExerciseCatalogEntry[]> | null = null;
let status: ExtendedCatalogStatus = 'idle';
const listeners = new Set<() => void>();

/** Lifecycle of the runtime fetch — drives the library's sync indicator. */
export type ExtendedCatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Current lifecycle state of the extended catalog load. */
export function extendedCatalogStatus(): ExtendedCatalogStatus {
  return status;
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

/**
 * Map gif-database items onto our catalog, drop anything the curated catalog
 * already covers, register the result for matching/search, and notify
 * subscribers. Returns the entries that were added. Exported for tests.
 */
export function applyExtendedCatalog(items: GifDbItem[]): ExerciseCatalogEntry[] {
  const mapped: ExerciseCatalogEntry[] = [];
  for (const item of items) {
    if (!item?.muscle || !item?.slug || !item?.name) continue;
    if (curatedGifKeys.has(`${item.muscle}/${item.slug}`)) continue;
    if (curatedNames.has(normalizeName(item.name))) continue;
    mapped.push(toEntry(item));
  }
  extendedList = mapped;
  loaded = true;
  status = 'ready';
  setExtendedExerciseEntries(mapped);
  notifyListeners();
  return mapped;
}

/** The currently registered extended entries (empty before the first load). */
export function extendedExercises(): ExerciseCatalogEntry[] {
  return extendedList;
}

/** How many extended entries are registered — use as an external-store snapshot. */
export function extendedExerciseCount(): number {
  return extendedList.length;
}

/** True once a catalog response has been applied (even if it added nothing). */
export function isExtendedCatalogLoaded(): boolean {
  return loaded;
}

/** Subscribe to catalog updates; returns an unsubscribe function. */
export function subscribeExtendedCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetch the full gif-database catalog and apply it. The request is made once
 * and shared; on failure the pending promise is cleared so a later call can
 * retry (e.g. after regaining connectivity).
 */
export function loadExtendedCatalog(): Promise<ExerciseCatalogEntry[]> {
  if (!loading) {
    status = 'loading';
    notifyListeners();
    loading = fetch(`${EXERCISE_GIF_BASE}/api/en/search.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`ExerciseGymGifsDB responded ${response.status}`);
        return response.json() as Promise<GifDbSearchFile>;
      })
      .then((data) => applyExtendedCatalog(data.items ?? []))
      .catch((error: unknown) => {
        loading = null; // allow a retry on the next call
        status = 'error';
        notifyListeners();
        throw error;
      });
  }
  return loading;
}
