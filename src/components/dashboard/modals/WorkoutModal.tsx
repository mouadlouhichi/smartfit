'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { CategoryIcon, chipAccentStyle } from '@/components/category-icon';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { INTENSITY_META, toISODate, fromKm, toKm } from '@smartfit/core';
import type { Intensity, WorkoutExercise } from '@smartfit/core';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { ExercisePicker } from '@/components/exercise-picker';

const BLANK_EXERCISE: WorkoutExercise = { name: '', sets: [{}] };

/**
 * Log or edit a session.
 *
 * Handles three entry points: a blank log, a prefill from a scheduled slot
 * ("mark today's session done"), and editing an existing record.
 */
export function WorkoutModal() {
  const { state, addSession, updateSession, deleteSession, estimateSessionCalories } = useStore();
  const { closeModal } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('workout');
  const open = payload !== null;

  const editing = payload?.session ?? null;
  const prefill = payload?.prefill ?? null;
  const distanceUnit = state.profile.distanceUnit;

  const [date, setDate] = useState(toISODate(new Date()));
  const [categoryId, setCategoryId] = useState('cat-strength');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('45');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([{ ...BLANK_EXERCISE }]);

  // Load the record (or the prefill) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const src = editing ?? prefill ?? null;
    setDate(src?.date ?? toISODate(new Date()));
    setCategoryId(src?.categoryId ?? 'cat-strength');
    setTitle(src?.title ?? '');
    setDuration(String(src?.durationMin ?? 45));
    setIntensity(src?.intensity ?? 'moderate');
    setDistance(
      src?.distanceKm !== undefined
        ? String(Math.round(fromKm(src.distanceKm, distanceUnit) * 100) / 100)
        : '',
    );
    setNotes(src?.notes ?? '');
    setExercises(
      src?.exercises && src.exercises.length
        ? src.exercises.map((e) => ({ ...e }))
        : [{ ...BLANK_EXERCISE }],
    );
  }, [open, editing, prefill, distanceUnit]);

  const cal = useMemo(
    () => estimateSessionCalories(Number(duration) || 0, intensity),
    [duration, intensity, estimateSessionCalories],
  );

  const category = state.categories.find((c) => c.id === categoryId);
  const isCardio = categoryId === 'cat-cardio' || categoryId === 'cat-sports';

  function addExercise() {
    setExercises((p) => [...p, { ...BLANK_EXERCISE, sets: [{}, {}] }]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mins = Number(duration);
    if (!Number.isFinite(mins) || mins <= 0) {
      setDurationError('Enter how many minutes the session took.');
      return;
    }
    setDurationError(null);
    const cleaned = exercises
      .filter((x) => x.name.trim())
      .map((x) => ({ ...x, name: x.name.trim() }));

    const record = {
      date,
      categoryId,
      title: title.trim() || category?.name || 'Workout',
      durationMin: Math.max(1, Math.round(mins)),
      intensity,
      calories: cal,
      distanceKm: isCardio && distance ? toKm(Number(distance), distanceUnit) : undefined,
      exercises: cleaned,
      notes: notes.trim() || undefined,
      scheduleId: editing?.scheduleId ?? prefill?.scheduleId,
    };

    if (editing) updateSession(editing.id, record);
    else addSession(record);
    closeModal();
  }

  async function removeSession() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: 'Delete this workout?',
      body: `"${editing.title}" will be removed from your log. This cannot be undone.`,
      confirmLabel: 'Delete workout',
      destructive: true,
    });
    if (!ok) return;
    deleteSession(editing.id);
    closeModal();
  }

  const accent = chipAccentStyle(category?.color);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <div className="flex items-start gap-3 pr-8">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                style={accent}
              >
                <CategoryIcon name={category?.icon ?? 'activity'} size={22} />
              </span>
              <div className="min-w-0">
                <DialogTitle>{editing ? 'Edit workout' : 'Log workout'}</DialogTitle>
                <DialogDescription>
                  {editing
                    ? 'Fix anything that went in wrong — totals, streaks and charts update instantly.'
                    : 'Every session you log feeds your weekly stats and streaks.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-5">
            {/* When + Type */}
            <div className="grid grid-cols-2 gap-3">
              <Field id="w-date" label="Date">
                <DatePicker
                  value={date}
                  onValueChange={setDate}
                  weekStartsOn={state.profile.weekStartsOn ?? 1}
                />
              </Field>
              <Field id="w-cat" label="Type">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </span>
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field id="w-title" label="Title">
              <Input
                placeholder={category?.name ?? 'Workout'}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            {/* Two columns on phones (the third field goes full-width below):
                three ~70px selects clip their own labels on a 320px dialog. */}
            <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:gap-3">
              <Field id="w-dur" label="Minutes" error={durationError}>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    setDurationError(null);
                  }}
                  required
                />
              </Field>
              <Field id="w-int" label="Intensity">
                <Select
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value as Intensity)}
                >
                  {Object.entries(INTENSITY_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.label}
                      </span>
                    </option>
                  ))}
                </Select>
              </Field>
              {isCardio ? (
                <Field
                  id="w-dist"
                  label={`Distance (${distanceUnit})`}
                  className="col-span-2 min-[430px]:col-span-1"
                >
                  <Input
                    type="number"
                    // step="any": 0.1 rejected splits like 5.25 km.
                    step="any"
                    min={0}
                    inputMode="decimal"
                    placeholder="0.0"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </Field>
              ) : (
                <div className="col-span-2 grid content-start gap-1.5 min-[430px]:col-span-1">
                  <p className="text-foreground/90 text-sm leading-none font-medium">Est. burn</p>
                  <div className="border-accent/60 bg-accent/40 flex h-11 items-center gap-2 rounded-xl border px-3 sm:h-10">
                    <Flame className="text-accent-foreground h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-foreground text-sm font-extrabold tabular-nums">
                      {cal}
                    </span>
                    <span className="text-accent-foreground/90 text-xs font-semibold">kcal</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live summary for cardio (duration · distance are already in the
                inputs above; this one line answers "what did it burn?"). */}
            {isCardio && (
              <div className="border-accent/60 bg-accent/30 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="bg-accent text-accent-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                    <Flame className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="text-foreground block text-sm font-bold">Estimated burn</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {Number(duration) > 0
                        ? `${Math.max(1, Math.round(Number(duration)))} min`
                        : '—'}{' '}
                      · {INTENSITY_META[intensity].label.toLowerCase()} effort
                    </span>
                  </span>
                </span>
                <span className="text-foreground shrink-0 text-lg font-extrabold tabular-nums">
                  {cal} kcal
                </span>
              </div>
            )}

            {/* Exercises */}
            <section className="border-border bg-secondary/40 grid gap-3 rounded-2xl border p-3 sm:p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground/90 text-sm leading-none font-medium">Exercises</p>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    Sets you completed — optional, but it makes history worth looking back at.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addExercise}
                  className="shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                </Button>
              </div>

              <div className="grid gap-2">
                {exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="border-border bg-card flex items-center gap-2 rounded-xl border p-1.5 shadow-sm sm:pl-2"
                  >
                    <span
                      aria-hidden
                      className="bg-secondary text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <ExercisePicker
                      ariaLabel={`Exercise ${i + 1} name`}
                      placeholder={`Exercise ${i + 1} (e.g. Squat)`}
                      maxLength={80}
                      value={ex.name}
                      onChange={(name) =>
                        setExercises((p) => p.map((x, xi) => (xi === i ? { ...x, name } : x)))
                      }
                    />
                    <Input
                      aria-label={`Exercise ${i + 1} sets`}
                      className="w-16 shrink-0 text-center min-[430px]:w-20"
                      type="number"
                      min={1}
                      placeholder="sets"
                      value={ex.sets.length}
                      onChange={(e) =>
                        setExercises((p) =>
                          p.map((x, xi) =>
                            xi === i
                              ? {
                                  ...x,
                                  sets: Array.from(
                                    { length: Math.max(1, Number(e.target.value) || 1) },
                                    (_, si) => x.sets[si] ?? {},
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExercises((p) => p.filter((_, xi) => xi !== i))}
                        aria-label={`Remove exercise ${i + 1}`}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <Field id="w-notes" label="Notes">
              <Input
                placeholder="How did it feel? (optional)"
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={removeSession}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save changes' : 'Save workout'}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
