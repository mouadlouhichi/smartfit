'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  ListChecks,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
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
import { DatePicker } from '@/components/ui/date-picker';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import {
  formatDateLabel,
  INTENSITY_META,
  relativeDay,
  toISODate,
  fromKm,
  toKm,
} from '@smartfit/core';
import type { Intensity, WorkoutExercise } from '@smartfit/core';
import { ExercisePicker } from '@/components/exercise-picker';
import { cn } from '@/lib/utils';

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
    setDurationError(null);
  }, [open, editing, prefill, distanceUnit]);

  const cal = useMemo(
    () => estimateSessionCalories(Number(duration) || 0, intensity),
    [duration, intensity, estimateSessionCalories],
  );

  const category = state.categories.find((c) => c.id === categoryId);
  const isCardio = categoryId === 'cat-cardio' || categoryId === 'cat-sports';
  const today = toISODate(new Date());

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
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader className="border-primary/15 from-primary/10 via-card to-secondary/60 relative overflow-hidden rounded-[1.6rem] border bg-gradient-to-br p-5 pr-12 shadow-sm sm:p-6 sm:pr-14">
            <div className="relative z-10 flex items-center gap-3">
              <span className="bg-primary text-primary-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md">
                <Dumbbell className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-primary text-[10px] font-extrabold tracking-[0.18em] uppercase">
                Training log
              </span>
            </div>
            <div className="relative z-10 mt-4">
              <DialogTitle className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {editing ? 'Tune your workout' : 'Log a workout'}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-md leading-relaxed">
                {editing
                  ? 'Update the details below and keep your training history honest.'
                  : 'Capture the work while it is fresh. Your streaks, goals and insights update instantly.'}
              </DialogDescription>
            </div>
            <div className="border-primary/15 bg-card/70 relative z-10 mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs shadow-sm backdrop-blur-sm">
              <span className="text-muted-foreground flex items-center gap-2 font-semibold">
                <CalendarClock className="text-primary h-4 w-4" aria-hidden />
                {relativeDay(date || today)}
              </span>
              <span className="text-foreground font-extrabold">
                {formatDateLabel(date || today)}
              </span>
            </div>
            <span
              aria-hidden
              className="bg-primary/10 absolute -right-8 -bottom-12 h-36 w-36 rounded-full blur-2xl"
            />
          </DialogHeader>

          <div className="grid gap-5">
            <FormSection
              icon={CalendarClock}
              title="When did you train?"
              hint="The date is ready to edit — pick a past day if you are catching up."
            >
              <Field id="w-date" label="Date">
                <DatePicker value={date} onChange={setDate} openOnMount />
              </Field>
              <Field id="w-cat" label="Workout type">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormSection>

            <FormSection
              icon={ListChecks}
              title="Session details"
              hint="A useful title makes your history easier to scan later."
            >
              <Field id="w-title" label="Title">
                <Input
                  placeholder={category?.name ?? 'Workout'}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                <MetricCard
                  className="col-span-2 sm:col-span-1"
                  label="Estimated burn"
                  value={`${cal}`}
                  suffix="kcal"
                  icon={Flame}
                />
              </div>

              {isCardio && (
                <Field
                  id="w-dist"
                  label={`Distance (${distanceUnit})`}
                  hint="Optional — use decimals for partial kilometres or miles."
                >
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </Field>
              )}
            </FormSection>

            <section className="border-border bg-secondary/45 grid gap-3 rounded-[1.35rem] border p-3.5 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  icon={Dumbbell}
                  title="Exercises"
                  hint="Optional — add movements and set counts when you want more detail."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExercises((p) => [...p, { name: '', sets: [{}, {}] }])}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add exercise
                </Button>
              </div>
              <div className="grid gap-2">
                {exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="border-border bg-card flex items-center gap-2 rounded-2xl border p-2 shadow-sm sm:gap-3 sm:p-2.5"
                  >
                    <span className="bg-secondary text-muted-foreground hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-extrabold tabular-nums sm:flex">
                      {String(i + 1).padStart(2, '0')}
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
                    <div className="grid shrink-0 gap-1">
                      <span className="text-muted-foreground px-1 text-[10px] font-bold uppercase">
                        Sets
                      </span>
                      <Input
                        aria-label={`Exercise ${i + 1} sets`}
                        className="h-10 w-14 px-2 text-center tabular-nums sm:w-16"
                        type="number"
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
                    </div>
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExercises((p) => p.filter((_, xi) => xi !== i))}
                        aria-label={`Remove exercise ${i + 1}`}
                        className="text-muted-foreground hover:text-destructive focus-visible:ring-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <FormSection
              icon={Clock3}
              title="Finish strong"
              hint="A quick note helps future-you spot patterns."
            >
              <Field id="w-notes" label="Notes">
                <Input
                  placeholder="How did it feel? (optional)"
                  value={notes}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </FormSection>
          </div>

          <DialogFooter className="mt-0 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={removeSession}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Delete workout
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <span className="flex w-full gap-2 sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none">
                <Check className="h-4 w-4" aria-hidden />
                {editing ? 'Save changes' : 'Save workout'}
                <Zap className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: typeof CalendarClock;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <SectionHeading icon={icon} title={title} hint={hint} />
      {children}
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof CalendarClock;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

function MetricCard({
  className,
  label,
  value,
  suffix,
  icon: Icon,
}: {
  className?: string;
  label: string;
  value: string;
  suffix: string;
  icon: typeof Flame;
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label>{label}</Label>
      <div className="border-primary/15 bg-primary/8 text-foreground flex h-11 items-center gap-2 rounded-xl border px-3 sm:h-10">
        <Icon className="text-primary h-4 w-4 shrink-0" aria-hidden />
        <span className="font-extrabold tabular-nums">{value}</span>
        <span className="text-muted-foreground text-xs font-semibold">{suffix}</span>
      </div>
    </div>
  );
}
