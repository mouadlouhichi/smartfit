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
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { INTENSITY_META, toISODate, fromKm, toKm } from '@smartfit/core';
import type { Intensity, WorkoutExercise } from '@smartfit/core';
import { Trash2 } from 'lucide-react';

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit workout' : 'Log workout'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Fix anything that went in wrong — totals, streaks and charts update instantly.'
                : 'Every session you log feeds your weekly stats and streaks.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field id="w-date" label="Date">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
              <Field id="w-cat" label="Type">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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

            <div className="grid grid-cols-3 gap-3">
              <Field id="w-dur" label="Minutes" error={durationError}>
                <Input
                  type="number"
                  min={1}
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
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {isCardio ? (
                <Field id="w-dist" label={`Distance (${distanceUnit})`}>
                  <Input
                    type="number"
                    // step="any": 0.1 rejected splits like 5.25 km.
                    step="any"
                    min={0}
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </Field>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="w-cal">Est. kcal</Label>
                  <div
                    id="w-cal"
                    className="border-input bg-secondary flex h-10 items-center rounded-xl border px-3 text-sm font-semibold"
                  >
                    {cal}
                  </div>
                </div>
              )}
            </div>

            {isCardio && (
              <div className="grid gap-1.5">
                <Label htmlFor="w-cal-cardio">Estimated burn</Label>
                <div
                  id="w-cal-cardio"
                  className="border-input bg-secondary flex h-10 items-center rounded-xl border px-3 text-sm font-semibold"
                >
                  {cal} kcal
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Exercises</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExercises((p) => [...p, { name: '', sets: [{}, {}] }])}
                >
                  + Add
                </Button>
              </div>
              <div className="grid gap-2">
                {exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`Exercise ${i + 1} name`}
                      placeholder={`Exercise ${i + 1} (e.g. Squat)`}
                      maxLength={80}
                      value={ex.name}
                      onChange={(e) =>
                        setExercises((p) =>
                          p.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      aria-label={`Exercise ${i + 1} sets`}
                      className="w-20"
                      type="number"
                      placeholder="sets"
                      value={ex.sets.length}
                      min={1}
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
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

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
