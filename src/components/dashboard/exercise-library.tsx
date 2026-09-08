'use client';

import { useMemo, useState } from 'react';
import { Dumbbell, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  EXERCISES,
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_GROUPS,
  EXERCISE_MUSCLE_LABELS,
  searchExercises,
  type ExerciseGroup,
} from '@smartfit/core';
import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseDetailDialog } from '@/components/exercise-detail';

/** Tiles rendered before "Show more" — keeps the grid's image loads light. */
const PAGE_SIZE = 24;

/**
 * The browsable exercise library on the Plan tab: the whole shared catalog
 * grouped by body section, searchable, with hover-animated demos. Tapping a
 * tile opens the step-by-step how-to. This is the "what can I do today"
 * shelf next to the plan strategy and the workout log.
 */
export function ExerciseLibrary() {
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [detailName, setDetailName] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of EXERCISES) map.set(e.group, (map.get(e.group) ?? 0) + 1);
    return map;
  }, []);

  const results = useMemo(() => {
    const base = query.trim() ? searchExercises(query, EXERCISES.length) : EXERCISES;
    return group === 'all' ? base : base.filter((e) => e.group === group);
  }, [group, query]);

  const shown = results.slice(0, visible);

  function selectGroup(next: ExerciseGroup | 'all') {
    setGroup(next);
    setVisible(PAGE_SIZE);
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="text-primary h-4 w-4" /> Exercise library
        </CardTitle>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            aria-label="Search exercises"
            placeholder="Search exercises…"
            className="h-9 pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Exercise groups">
          <Chip active={group === 'all'} onClick={() => selectGroup('all')}>
            All <span className="opacity-60">{EXERCISES.length}</span>
          </Chip>
          {EXERCISE_GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => selectGroup(g.id)}>
              {g.label} <span className="opacity-60">{counts.get(g.id) ?? 0}</span>
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nothing matches “{query.trim()}” — try another name, muscle or equipment.
          </p>
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
                <ExerciseImage name={entry.name} className="h-20 w-20 rounded-lg" animateOnHover />
                <span className="text-foreground mt-1 w-full truncate text-sm font-medium">
                  {entry.name}
                </span>
                <span className="text-muted-foreground w-full truncate text-xs">
                  {EXERCISE_MUSCLE_LABELS[entry.muscles[0]]} ·{' '}
                  {EXERCISE_EQUIPMENT_LABELS[entry.equipment]}
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
      />
    </Card>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
      )}
    >
      {children}
    </button>
  );
}
