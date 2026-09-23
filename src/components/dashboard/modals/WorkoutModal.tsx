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
import { useI18n } from '@/lib/i18n-context';
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
  const { t } = useI18n();
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
      setDurationError(t('modal.workout.durationError'));
      return;
    }
    setDurationError(null);
    const cleaned = exercises
      .filter((x) => x.name.trim())
      .map((x) => ({ ...x, name: x.name.trim() }));

    const record = {
      date,
      categoryId,
      title: title.trim() || category?.name || t('modal.workout.fallbackTitle'),
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
      title: t('modal.workout.deleteTitle'),
      body: t('modal.workout.deleteBody', { name: editing.title }),
      confirmLabel: t('modal.workout.deleteConfirm'),
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
                <DialogTitle>
                  {editing ? t('modal.workout.title.edit') : t('modal.workout.title.new')}
                </DialogTitle>
                <DialogDescription>
                  {editing ? t('modal.workout.blurb.edit') : t('modal.workout.blurb.new')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-5">
            {/* When + Type */}
            <div className="grid grid-cols-2 gap-3">
              <Field id="w-date" label={t('modal.field.date')}>
                <DatePicker
                  value={date}
                  onValueChange={setDate}
                  weekStartsOn={state.profile.weekStartsOn ?? 1}
                />
              </Field>
              <Field id="w-cat" label={t('modal.field.type')}>
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

            <Field id="w-title" label={t('modal.field.title')}>
              <Input
                placeholder={category?.name ?? t('modal.workout.fallbackTitle')}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            {/* Two columns on phones (the third field goes full-width below):
                three ~70px selects clip their own labels on a 320px dialog. */}
            <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:gap-3">
              <Field id="w-dur" label={t('modal.field.minutes')} error={durationError}>
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
              <Field id="w-int" label={t('modal.field.intensity')}>
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
                  <p className="text-foreground/90 text-sm leading-none font-medium">
                    {t('modal.workout.estBurn')}
                  </p>
                  <div className="border-accent/60 bg-accent/40 flex h-11 items-center gap-2 rounded-xl border px-3 sm:h-10">
                    <Flame className="text-accent-foreground h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-foreground text-sm font-extrabold tabular-nums">
                      {cal}
                    </span>
                    <span className="text-accent-foreground/90 text-xs font-semibold">
                      {t('modal.workout.kcal')}
                    </span>
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
                    <span className="text-foreground block text-sm font-bold">
                      {t('modal.workout.estimatedBurn')}
                    </span>
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
            <section className="border-border bg-secondary/40 grid min-w-0 gap-3 rounded-2xl border p-3 sm:p-3.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground/90 text-sm leading-none font-medium">
                    {t('modal.workout.exercises')}
                  </p>
                  {/* Wraps instead of truncating: `truncate` is white-space:
                      nowrap, and a nowrap line reports its full length as the
                      section's min-content width — which stretched every
                      grid track in this sheet past the phone's edge. */}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('modal.workout.setsHint')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addExercise}
                  className="shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> {t('action.add')}
                </Button>
              </div>

              <div className="grid gap-2">
                {exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="border-border bg-card flex min-w-0 items-center gap-2 rounded-xl border p-1.5 shadow-sm sm:pl-2"
                  >
                    <span
                      aria-hidden
                      className="bg-secondary text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <ExercisePicker
                      compact
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
                      placeholder={t('modal.workout.setsPlaceholder')}
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

            <Field id="w-notes" label={t('modal.field.notes')}>
              <Input
                placeholder={t('modal.field.feel')}
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={removeSession}
                className="text-destructive hover:text-destructive w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" /> {t('action.delete')}
              </Button>
            )}
            {/* Mobile: full-width stacked actions (the footer is
                flex-col-reverse, so the primary sits on top). From sm up they
                collapse back into the classic inline row. */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                className="w-full sm:w-auto"
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editing ? t('modal.workout.saveChanges') : t('modal.workout.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
