'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloudOff, Dumbbell, Loader2, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  EXERCISE_GROUPS,
  EXERCISE_EQUIPMENT_LABELS,
  exerciseVocabulary,
  exerciseMeasure,
  searchExercises,
  suggestExercises,
  type ExerciseEquipment,
  type ExerciseGroup,
  type ExerciseMuscle,
} from '@smartfit/core';
import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseDetailDialog } from '@/components/exercise-detail';
import { useAllExercises, useExtendedCatalogStatus } from '@/lib/use-extended-catalog';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';

/** Tiles rendered before "Show more" — keeps the grid's image loads light. */
const PAGE_SIZE = 24;

/** Browse sections; "all", "popular" and "suggested" are pseudo-sections. */
type GroupFilter = ExerciseGroup | 'all' | 'popular' | 'suggested';
/** Result order: curated-first (default) or alphabetical. */
type SortMode = 'recommended' | 'az';

/** Equipment chips in a sensible browse order rather than type-declaration order. */
const EQUIPMENT_ORDER: ExerciseEquipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'body',
  'kettlebell',
  'band',
  'ez-bar',
  'running',
  'pool',
  'other',
];

function inGroup(
  entry: { group: ExerciseGroup; popular?: boolean; name: string },
  group: GroupFilter,
  suggested: Set<string>,
): boolean {
  if (group === 'all') return true;
  if (group === 'popular') return !!entry.popular;
  if (group === 'suggested') return suggested.has(entry.name);
  return entry.group === group;
}

/**
 * The browsable exercise library on the Plan tab: the whole shared catalog —
 * curated 103 plus the runtime-fetched full library — with body-section
 * chips, an equipment filter, muscle focus chips, search and A–Z ordering.
 * Tapping a tile opens the step-by-step how-to.
 */
export function ExerciseLibrary() {
  const { t } = useI18n();
  // One memo for every id → label lookup on this screen, so the library
  // reads in the active locale rather than through the English maps.
  const vocab = useMemo(() => exerciseVocabulary(t), [t]);
  const [group, setGroup] = useState<GroupFilter>('all');
  const [muscle, setMuscle] = useState<ExerciseMuscle | null>(null);
  const [equipment, setEquipment] = useState<ExerciseEquipment | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recommended');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [detailName, setDetailName] = useState<string | null>(null);

  // The full 1,323-exercise catalog arrives at runtime; counts and results
  // refresh when it lands. Until then this shows the curated 103.
  const catalog = useAllExercises();
  const status = useExtendedCatalogStatus();
  const { state } = useStore();
  // "For you" pseudo-section — the same engine as the profile suggestions.
  const suggestedNames = useMemo(
    () => new Set(suggestExercises(state).map((s) => s.entry.name)),
    [state],
  );

  // Search once; every filter below composes on top of the ranked matches,
  // so the chip counts stay meaningful while searching.
  const searched = useMemo(() => {
    const q = query.trim();
    return q ? searchExercises(q, catalog.length) : catalog;
  }, [query, catalog]);

  const results = useMemo(() => {
    const filtered = searched.filter(
      (e) =>
        inGroup(e, group, suggestedNames) &&
        (!muscle || e.muscles.includes(muscle)) &&
        (!equipment || e.equipment === equipment),
    );
    return sort === 'az' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered;
  }, [searched, group, muscle, equipment, sort, suggestedNames]);

  // Facet counts: each row counts what the *other* filters leave behind, so
  // the chips narrate "12 barbell chest moves" as filters stack up.
  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of searched) {
      if (muscle && !e.muscles.includes(muscle)) continue;
      if (equipment && e.equipment !== equipment) continue;
      map.set(e.group, (map.get(e.group) ?? 0) + 1);
      if (e.popular) map.set('popular', (map.get('popular') ?? 0) + 1);
      if (suggestedNames.has(e.name)) map.set('suggested', (map.get('suggested') ?? 0) + 1);
    }
    return map;
  }, [searched, muscle, equipment, suggestedNames]);

  const allCount = useMemo(
    () => EXERCISE_GROUPS.reduce((sum, g) => sum + (groupCounts.get(g.id) ?? 0), 0),
    [groupCounts],
  );

  const equipmentCounts = useMemo(() => {
    const map = new Map<ExerciseEquipment, number>();
    for (const e of searched) {
      if (!inGroup(e, group, suggestedNames)) continue;
      if (muscle && !e.muscles.includes(muscle)) continue;
      map.set(e.equipment, (map.get(e.equipment) ?? 0) + 1);
    }
    return map;
  }, [searched, group, muscle, suggestedNames]);

  // Muscle focus chips appear when a section is selected and splits into
  // more than one muscle (Back → Lats/Traps/…, Legs → Quads/Hamstrings/…).
  const muscleOptions = useMemo(() => {
    if (group === 'all' || group === 'popular' || group === 'suggested') return [];
    const map = new Map<ExerciseMuscle, number>();
    for (const e of searched) {
      if (e.group !== group) continue;
      if (equipment && e.equipment !== equipment) continue;
      for (const m of e.muscles) map.set(m, (map.get(m) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([m, count]) => ({ muscle: m, count }))
      .sort((a, b) => b.count - a.count || a.muscle.localeCompare(b.muscle));
  }, [searched, group, equipment]);

  const shown = results.slice(0, visible);
  const hasFilters = group !== 'all' || muscle !== null || equipment !== null || !!query.trim();

  // Paging resets whenever the result set changes shape.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [group, muscle, equipment, query, sort]);

  function selectGroup(next: GroupFilter) {
    setGroup(next);
    setMuscle(null); // muscle focus belongs to its section
  }

  function clearFilters() {
    setGroup('all');
    setMuscle(null);
    setEquipment(null);
    setQuery('');
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="text-primary h-4 w-4" /> {t('library.title')}
          <span className="text-muted-foreground font-normal">{catalog.length}</span>
        </CardTitle>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            aria-label={t('library.searchAria')}
            placeholder={t('library.searchPlaceholder')}
            className="pr-8 pl-9 sm:h-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label={t('library.clearSearch')}
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={t('library.sectionsAria')}
        >
          <Chip active={group === 'all'} onClick={() => selectGroup('all')}>
            {t('library.section.all')} <span className="opacity-60">{allCount}</span>
          </Chip>
          <Chip active={group === 'popular'} onClick={() => selectGroup('popular')}>
            {t('library.section.popular')}{' '}
            <span className="opacity-60">{groupCounts.get('popular') ?? 0}</span>
          </Chip>
          <Chip active={group === 'suggested'} onClick={() => selectGroup('suggested')}>
            {t('library.section.suggested')}{' '}
            <span className="opacity-60">{groupCounts.get('suggested') ?? 0}</span>
          </Chip>
          {EXERCISE_GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => selectGroup(g.id)}>
              {vocab.group(g.id)}{' '}
              <span className={cn(groupCounts.get(g.id) ? 'opacity-60' : 'opacity-30')}>
                {groupCounts.get(g.id) ?? 0}
              </span>
            </Chip>
          ))}
        </div>

        <div
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label={t('library.equipmentAria')}
        >
          <span className="text-muted-foreground pr-1 text-xs font-semibold tracking-wide uppercase">
            {t('library.equipment')}
          </span>
          <Chip active={equipment === null} onClick={() => setEquipment(null)} className="shrink-0">
            {t('library.equipmentAny')}
          </Chip>
          {EQUIPMENT_ORDER.filter(
            (eq) => equipment === eq || (equipmentCounts.get(eq) ?? 0) > 0,
          ).map((eq) => (
            <Chip
              key={eq}
              active={equipment === eq}
              onClick={() => setEquipment(equipment === eq ? null : eq)}
              className="shrink-0"
            >
              {vocab.equipment(eq)}{' '}
              <span className="opacity-60">{equipmentCounts.get(eq) ?? 0}</span>
            </Chip>
          ))}
        </div>

        {muscleOptions.length >= 2 && (
          <div
            className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1"
            role="group"
            aria-label={t('library.focusAria')}
          >
            <span className="text-muted-foreground pr-1 text-xs font-semibold tracking-wide uppercase">
              {t('library.focus')}
            </span>
            {muscleOptions.map(({ muscle: m, count }) => (
              <Chip
                key={m}
                active={muscle === m}
                onClick={() => setMuscle(muscle === m ? null : m)}
                className="shrink-0"
              >
                {vocab.muscle(m)} <span className="opacity-60">{count}</span>
              </Chip>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t('library.results', { count: results.length })}
            </span>
            {status === 'loading' && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {t('library.syncing')}
              </span>
            )}
            {status === 'error' && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                {t('library.offline')}
              </span>
            )}
            {group !== 'all' && (
              <FilterPill
                label={
                  group === 'popular'
                    ? t('library.section.popular')
                    : group === 'suggested'
                      ? t('library.section.suggested')
                      : EXERCISE_GROUPS.some((g) => g.id === group)
                        ? vocab.group(group)
                        : group
                }
                onClear={() => selectGroup('all')}
              />
            )}
            {muscle && <FilterPill label={vocab.muscle(muscle)} onClear={() => setMuscle(null)} />}
            {equipment && (
              <FilterPill
                label={EXERCISE_EQUIPMENT_LABELS[equipment]}
                onClear={() => setEquipment(null)}
              />
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
              >
                {t('library.clearAll')}
              </button>
            )}
          </div>
          <div
            className="bg-secondary flex rounded-full p-0.5"
            role="group"
            aria-label={t('library.sortAria')}
          >
            {(['recommended', 'az'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={sort === mode}
                onClick={() => setSort(mode)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                  sort === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode === 'recommended' ? t('library.sort.recommended') : t('library.sort.az')}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <Dumbbell className="text-muted-foreground/40 h-8 w-8" strokeWidth={1.5} />
            <p className="text-foreground text-sm font-medium">{t('library.emptyTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('library.emptyBody')}</p>
            {hasFilters && (
              <Button variant="secondary" size="sm" className="mt-1" onClick={clearFilters}>
                {t('library.emptyCta')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setDetailName(entry.name)}
                title={`How to do ${entry.name}`}
                className="border-border hover:border-primary/50 hover:bg-secondary/40 flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors"
              >
                <ExerciseImage
                  name={entry.name}
                  className="h-20 w-20 rounded-lg"
                  animateOnHover
                  badge={vocab.equipment(entry.equipment)}
                />
                <span className="text-foreground mt-1 w-full truncate text-sm font-medium">
                  {entry.name}
                </span>
                <span className="text-muted-foreground w-full truncate text-xs">
                  {vocab.muscle(entry.muscles[0])}
                  {exerciseMeasure(entry) === 'distance' ? t('library.metres') : ''}
                  {entry.extended ? t('library.fullLibrary') : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {results.length > shown.length && (
          <Button
            variant="secondary"
            className="mx-auto"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Show more ({results.length - shown.length} left)
          </Button>
        )}
      </CardContent>

      <ExerciseDetailDialog
        name={detailName}
        open={!!detailName}
        onOpenChange={(o) => !o && setDetailName(null)}
        allowStart
      />
    </Card>
  );
}

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Removable pill showing one active filter. */
function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Clear ${label} filter`}
      className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors"
    >
      {label}
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
