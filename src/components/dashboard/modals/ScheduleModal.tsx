'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import {
  FREE_ROUTINE_TEMPLATES,
  INTENSITY_META,
  WEEKDAYS_LONG,
  hasProAccess,
} from '@smartfit/core';
import type { Intensity, Weekday, WorkoutExercise } from '@smartfit/core';
import { Crown, Plus, Trash2, X } from 'lucide-react';
import { ExercisePicker } from '@/components/exercise-picker';
import { ExerciseImage } from '@/components/exercise-image';

interface RoutineRow {
  id: number;
  name: string;
  sets: number;
}

export function ScheduleModal() {
  const { state, addSchedule, updateSchedule, deleteSchedule } = useStore();
  const { closeModal, openWith } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('schedule');
  const open = payload !== null;
  const editing = payload?.schedule ?? null;

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('cat-strength');
  const [weekday, setWeekday] = useState<Weekday>(1);
  const [time, setTime] = useState('07:00');
  const [duration, setDuration] = useState('45');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [active, setActive] = useState(true);
  const [routine, setRoutine] = useState<RoutineRow[]>([]);
  const rowId = useRef(1);

  const pro = hasProAccess(state);
  // Slots that already carry a routine. Adding a routine to an empty slot is
  // what creates a *new* template — that is the gated action on the free tier.
  const templateCount = state.schedule.filter((s) => (s.exercises?.length ?? 0) > 0).length;
  const editingHadRoutine = (editing?.exercises?.length ?? 0) > 0;
  const routineValid = routine.filter((r) => r.name.trim().length > 0);
  const atTemplateCap =
    !pro &&
    !editingHadRoutine &&
    routineValid.length > 0 &&
    templateCount >= FREE_ROUTINE_TEMPLATES;

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setCategoryId(editing?.categoryId ?? 'cat-strength');
    setWeekday(editing?.weekday ?? 1);
    setTime(editing?.timeOfDay ?? '07:00');
    setDuration(String(editing?.durationMin ?? 45));
    setIntensity(editing?.intensity ?? 'moderate');
    setActive(editing?.active ?? true);
    setRoutine(
      (editing?.exercises ?? []).map((e) => ({
        id: rowId.current++,
        name: e.name,
        sets: Math.max(1, e.sets.length),
      })),
    );
  }, [open, editing]);

  function addRoutineRow() {
    setRoutine((rows) => [...rows, { id: rowId.current++, name: '', sets: 3 }]);
  }

  function routineToExercises(): WorkoutExercise[] | undefined {
    if (routineValid.length === 0) return undefined;
    return routineValid.map((r) => ({
      name: r.name.trim(),
      sets: Array.from({ length: Math.max(1, r.sets) }, () => ({})),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mins = Number(duration);
    if (!Number.isFinite(mins) || mins <= 0) {
      setDurationError('Enter how long the session should be.');
      return;
    }
    // Free tier: a 4th routine template is a Pro feature — route to the paywall.
    if (atTemplateCap) {
      closeModal();
      openWith({ kind: 'pro' });
      return;
    }
    setDurationError(null);
    const record = {
      title: title.trim() || 'Scheduled session',
      categoryId,
      weekday,
      timeOfDay: time,
      durationMin: Math.max(5, Math.round(mins)),
      intensity,
      active,
      exercises: routineToExercises(),
    };
    if (editing) updateSchedule(editing.id, record);
    else addSchedule(record);
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: 'Remove from your weekly plan?',
      body: `"${editing.title}" will no longer be scheduled. Logged workouts are kept.`,
      confirmLabel: 'Remove session',
      destructive: true,
    });
    if (!ok) return;
    deleteSchedule(editing.id);
    closeModal();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit session' : 'Plan a session'}</DialogTitle>
            <DialogDescription>
              Recurring slots build your week. Today&apos;s slots appear on the dashboard so you can
              tick them off as you train.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <Field id="s-title" label="Title">
              <Input
                placeholder="e.g. Upper body"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="s-cat" label="Type">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="s-day" label="Day">
                <Select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
                >
                  {WEEKDAYS_LONG.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field id="s-time" label="Time">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
              <Field id="s-dur" label="Minutes" error={durationError}>
                <Input
                  type="number"
                  min={5}
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    setDurationError(null);
                  }}
                />
              </Field>
              <Field id="s-int" label="Intensity">
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
            </div>

            {/* ── Routine builder: the exercise list the guided runner loads ─ */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Routine</span>
                <Button type="button" variant="outline" size="sm" onClick={addRoutineRow}>
                  <Plus className="h-3.5 w-3.5" /> Add exercise
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Optional — a routine becomes a reusable template the Start button loads, pre-filled
                with your last numbers.
              </p>
              {routine.length === 0 ? null : (
                <ul className="grid gap-2">
                  {routine.map((row) => (
                    <li
                      key={row.id}
                      className="bg-secondary flex items-center gap-2 rounded-xl p-2"
                    >
                      <ExerciseImage
                        name={row.name}
                        className="h-9 w-9 shrink-0 rounded-lg"
                        animated={false}
                      />
                      <div className="min-w-0 flex-1">
                        <ExercisePicker
                          value={row.name}
                          onChange={(v) =>
                            setRoutine((rows) =>
                              rows.map((r) => (r.id === row.id ? { ...r, name: v } : r)),
                            )
                          }
                          placeholder="Exercise (e.g. Squat)"
                          ariaLabel={`Routine exercise`}
                        />
                      </div>
                      <label className="text-muted-foreground flex items-center gap-1 text-xs">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={row.sets}
                          onChange={(e) =>
                            setRoutine((rows) =>
                              rows.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      sets: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                                    }
                                  : r,
                              ),
                            )
                          }
                          className="border-input bg-background h-8 w-14 rounded-lg border text-center text-sm font-semibold"
                          aria-label="Target sets"
                        />
                        sets
                      </label>
                      <button
                        type="button"
                        onClick={() => setRoutine((rows) => rows.filter((r) => r.id !== row.id))}
                        aria-label="Remove exercise"
                        className="text-muted-foreground hover:text-destructive press flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {atTemplateCap && (
                <div className="bg-accent text-accent-foreground flex items-start gap-2 rounded-xl px-3 py-2 text-xs">
                  <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    You&apos;ve used all {FREE_ROUTINE_TEMPLATES} free routine templates. SmartFit
                    Pro unlocks unlimited routines — this one will open the paywall when saved.
                  </span>
                </div>
              )}
            </div>

            <label className="border-border flex items-center justify-between rounded-xl border px-3 py-2.5">
              <span className="text-sm">
                <span className="font-medium">Active</span>
                <span className="text-muted-foreground block text-xs">
                  Inactive slots stay in your plan but don&apos;t show up on the dashboard.
                </span>
              </span>
              <Switch checked={active} onCheckedChange={setActive} aria-label="Slot active" />
            </label>
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save session' : 'Add to plan'}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
