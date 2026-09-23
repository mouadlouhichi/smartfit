'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Footprints, Info, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_MUSCLE_LABELS,
  exerciseMeasure,
  matchExercise,
  searchExercises,
  type ExerciseCatalogEntry,
} from '@smartfit/core';
import { ExerciseImage } from './exercise-image';
import { ExerciseDetailDialog } from './exercise-detail';
import { useExtendedCatalog } from '@/lib/use-extended-catalog';
import { useAuth } from '@/lib/firebase/auth-context';

const SUGGESTION_LIMIT = 8;
/** Recently-picked exercise names, most recent first (per account/device). */
const RECENTS_KEY = 'smartfit.exercise.recents.v1';
const RECENTS_CAP = 8;
const recentsKey = (owner: string) => `${RECENTS_KEY}.${owner}`;

function readRecents(owner: string): string[] {
  try {
    const raw = localStorage.getItem(recentsKey(owner));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

function rememberRecent(name: string, owner: string) {
  try {
    const next = [name, ...readRecents(owner).filter((n) => n !== name)].slice(0, RECENTS_CAP);
    localStorage.setItem(recentsKey(owner), JSON.stringify(next));
  } catch {
    /* storage unavailable — recents simply stay empty */
  }
}

/** Bold the query tokens wherever they appear in a suggestion name. */
function HighlightedName({ text, query }: { text: string; query: string }) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of tokens) {
    let i = lower.indexOf(t);
    while (i >= 0) {
      ranges.push([i, i + t.length]);
      i = lower.indexOf(t, i + 1);
    }
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r] as [number, number]);
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([from, to], i) => {
    if (from > cursor) parts.push(text.slice(cursor, from));
    parts.push(
      <mark
        key={i}
        className="bg-transparent font-extrabold text-inherit underline decoration-2 underline-offset-2"
        style={{ textDecorationColor: 'var(--chart-1)' }}
      >
        {text.slice(from, to)}
      </mark>,
    );
    cursor = to;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * Exercise name field with a searchable, illustrated suggestions list.
 *
 * Free text stays first-class — the user can still type any custom name —
 * but matching entries from the shared catalog can be picked with a click
 * or the keyboard, which links the log entry to a demo image. Every
 * suggestion carries an info button that opens the how-to steps, a distance
 * badge when the movement logs metres instead of kilos, and matched text is
 * highlighted. Recent picks lead when the field is empty.
 */
export function ExercisePicker({
  value,
  onChange,
  placeholder,
  ariaLabel,
  maxLength,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Cap the free-text name length (same intent as the plain Input fields). */
  maxLength?: number;
  /**
   * Tight table rows (log-modal exercise lines): the leading thumbnail hides
   * below 480px so the name field keeps a usable width on phones. Full-width
   * call sites (runner, library) leave this off.
   */
  compact?: boolean;
}) {
  const { user, mode } = useAuth();
  const ownerKey = user?.uid ?? (mode === 'cloud' ? 'signed-out' : 'local');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();

  // Once the extended (runtime) catalog lands, suggestions and the matched
  // badge cover the full 1,323-exercise library, not just the curated 103.
  const extendedCount = useExtendedCatalog();
  const suggestions = useMemo(
    () => searchExercises(value, SUGGESTION_LIMIT, { recentNames: recents }),
    // `extendedCount` re-runs the search once the runtime catalog lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, extendedCount, recents],
  );
  // Total matches for the "n of m" footer — the ranked scan is a few ms.
  const totalMatches = useMemo(
    () => (value.trim() ? searchExercises(value, 1000, { recentNames: recents }).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, extendedCount, recents],
  );
  const matched = matchExercise(value);
  const recentIds = useMemo(() => {
    const ids = new Set<string>();
    if (value.trim()) return ids;
    for (const name of recents) {
      const entry = matchExercise(name);
      if (entry) ids.add(entry.id);
    }
    return ids;
  }, [recents, value]);

  // Recents live in localStorage — read once on mount (SSR-safe).
  useEffect(() => {
    setRecents(readRecents(ownerKey));
  }, [ownerKey]);

  // Keep the highlighted row in range whenever the query changes.
  useEffect(() => {
    setHighlight(0);
  }, [value]);

  // Keep keyboard navigation on screen.
  useEffect(() => {
    if (open) rowRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  // Close on outside pointer presses (the dialog itself stays open).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function select(index: number) {
    const entry = suggestions[index];
    if (!entry) return;
    onChange(entry.name);
    rememberRecent(entry.name, ownerKey);
    setRecents(readRecents(ownerKey));
    setOpen(false);
    rootRef.current?.querySelector('input')?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        // Only intercept Enter when picking would actually change something;
        // if the row is already what's typed, let the form save as before.
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (suggestions[highlight]?.name === value) return;
        e.preventDefault();
        e.stopPropagation();
        select(highlight);
        break;
      case 'Escape':
        e.stopPropagation();
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <ExerciseImage
          name={value}
          className={cn('h-9 w-9 shrink-0 rounded-lg', compact && 'hidden min-[480px]:flex')}
          animated={false}
        />
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <input
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            role="combobox"
            aria-autocomplete="list"
            aria-activedescendant={open ? `${listId}-row-${highlight}` : undefined}
            autoComplete="off"
            className="border-input bg-field placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring h-11 w-full rounded-xl border pr-9 pl-9 text-base shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:h-10 sm:text-sm"
            placeholder={placeholder}
            maxLength={maxLength}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {value && (
            <button
              type="button"
              aria-label="Clear exercise search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                setOpen(true);
                rootRef.current?.querySelector('input')?.focus();
              }}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Exercise suggestions"
          className="border-border bg-popover text-popover-foreground scrollbar absolute top-[calc(100%+0.375rem)] left-0 z-30 max-h-72 w-full overflow-y-auto rounded-xl border p-1 shadow-lg"
        >
          {suggestions.length === 0 && (
            <li className="text-muted-foreground px-3 py-2.5 text-sm">
              No match in the library — “{value.trim()}” is kept as your own exercise.
            </li>
          )}
          {suggestions.map((entry, i) => {
            const active = i === highlight;
            const selected = matched?.id === entry.id && entry.name === value;
            const isRecent = recentIds.has(entry.id);
            const isDistance = exerciseMeasure(entry) === 'distance';
            const showRecentHeader = i === 0 && isRecent;
            const showPopularHeader =
              i > 0 && !isRecent && recentIds.has(suggestions[i - 1]?.id ?? '');
            return (
              <li key={entry.id}>
                {showRecentHeader && (
                  <p className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest uppercase">
                    Recent
                  </p>
                )}
                {showPopularHeader && (
                  <p className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest uppercase">
                    Popular
                  </p>
                )}
                <div
                  ref={(el) => {
                    rowRefs.current[i] = el?.closest('li') ?? null;
                  }}
                  id={`${listId}-row-${i}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'flex items-center gap-1 rounded-lg transition-colors',
                    active ? 'bg-accent' : 'bg-transparent',
                  )}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep the input's blur/click ordering sane
                      select(i);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
                  >
                    <ExerciseImage
                      name={entry.name}
                      className="h-9 w-9 rounded-lg"
                      animated={false}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-sm font-medium">
                        <HighlightedName text={entry.name} query={value} />
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                        {EXERCISE_MUSCLE_LABELS[entry.muscles[0]]} ·{' '}
                        {EXERCISE_EQUIPMENT_LABELS[entry.equipment]}
                        {isDistance && (
                          <span
                            title="Logs distance"
                            className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold"
                          >
                            <Footprints className="h-3 w-3" aria-hidden />m
                          </span>
                        )}
                      </span>
                    </span>
                    {selected && <Check className="text-primary h-4 w-4 shrink-0" />}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`How to do ${entry.name}`}
                    title="How to do it"
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDetailName(entry.name);
                    }}
                    className="text-muted-foreground hover:text-foreground mr-1 shrink-0 rounded-full p-2.5"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
          {totalMatches > suggestions.length && (
            <li
              aria-hidden="true"
              className="text-muted-foreground border-border mt-1 border-t px-3 pt-2 pb-1.5 text-xs"
            >
              {suggestions.length} of {totalMatches} — keep typing to narrow it down
            </li>
          )}
        </ul>
      )}

      <ExerciseDetailDialog
        name={detailName}
        open={!!detailName}
        onOpenChange={(o) => !o && setDetailName(null)}
      />
    </div>
  );
}
