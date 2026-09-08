'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_MUSCLE_LABELS,
  matchExercise,
  searchExercises,
} from '@smartfit/core';
import { ExerciseImage } from './exercise-image';

/**
 * Exercise name field with a searchable, illustrated suggestions list.
 *
 * Free text stays first-class — the user can still type any custom name —
 * but matching entries from the shared catalog can be picked with a click
 * or the keyboard, which links the log entry to a demo image.
 */
export function ExercisePicker({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const suggestions = useMemo(() => searchExercises(value, 8), [value]);
  const matched = useMemo(() => matchExercise(value), [value]);

  // Keep the highlighted row in range whenever the query changes.
  useEffect(() => {
    setHighlight(0);
  }, [value]);

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
        <ExerciseImage name={value} className="h-9 w-9 rounded-lg" animated={false} />
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
            autoComplete="off"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring h-10 w-full rounded-xl border pr-3 pl-9 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
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
            return (
              <li key={entry.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep the input's blur/click ordering sane
                    select(i);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                    active ? 'bg-accent' : 'bg-transparent',
                  )}
                >
                  <ExerciseImage
                    name={entry.name}
                    className="h-9 w-9 rounded-lg"
                    animated={false}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {entry.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {EXERCISE_MUSCLE_LABELS[entry.muscles[0]]} ·{' '}
                      {EXERCISE_EQUIPMENT_LABELS[entry.equipment]}
                    </span>
                  </span>
                  {selected && <Check className="text-primary h-4 w-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
