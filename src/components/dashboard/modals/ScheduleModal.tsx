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
import { useI18n } from '@/lib/i18n-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import {
  FREE_ROUTINE_TEMPLATES,
  INTENSITY_META,
  hasProAccess,
  weekdayLabels,
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
  const { t, locale } = useI18n();
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
      setDurationError(t('modal.schedule.durationError'));
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
      title: title.trim() || t('modal.schedule.fallbackTitle'),
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
      title: t('modal.schedule.removeTitle'),
      body: t('modal.schedule.removeBody', { name: editing.title }),
      confirmLabel: t('modal.schedule.removeConfirm'),
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
            <DialogTitle>
              {editing ? t('modal.schedule.title.edit') : t('modal.schedule.title.new')}
            </DialogTitle>
            <DialogDescription>{t('modal.schedule.blurb')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <Field id="s-title" label={t('modal.field.title')}>
              <Input
                placeholder={t('modal.field.upperBody')}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="s-cat" label={t('modal.field.type')}>
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
                  {weekdayLabels(locale, 'long').map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Two columns on phones (intensity goes full-width below): a
                time input needs more than the ~70px a 3-column phone row
                gives it. */}
            <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:gap-3">
              <Field id="s-time" label={t('modal.field.time')}>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
              <Field id="s-dur" label={t('modal.field.minutes')} error={durationError}>
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
              <Field
                id="s-int"
                label={t('modal.field.intensity')}
                className="col-span-2 min-[430px]:col-span-1"
              >
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
                <span className="text-sm font-medium">{t('modal.schedule.routine')}</span>
                <Button type="button" variant="outline" size="sm" onClick={addRoutineRow}>
                  <Plus className="h-3.5 w-3.5" /> {t('modal.schedule.addExercise')}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{t('modal.schedule.routineHint')}</p>
              {routine.length === 0 ? null : (
                <ul className="grid gap-2">
                  {routine.map((row) => (
                    <li
                      key={row.id}
                      className="bg-secondary flex items-center gap-2 rounded-xl p-2"
                    >
                      {/* The picker renders its own thumbnail, so this preview
                          tile is redundant on phones — hide it to give the
                          name field room to breathe. */}
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
                          placeholder={t('modal.schedule.exercisePlaceholder')}
                          ariaLabel={t('modal.schedule.routineExerciseAria')}
                        />
                      </div>
                      <label className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
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
                          className="border-input bg-field h-8 w-12 rounded-lg border text-center text-sm font-semibold min-[480px]:w-14"
                          aria-label={t('modal.schedule.targetSetsAria')}
                        />
                        <span>{t('modal.schedule.sets')}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setRoutine((rows) => rows.filter((r) => r.id !== row.id))}
                        aria-label={t('modal.schedule.removeExerciseAria')}
                        className="text-muted-foreground hover:text-destructive press flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
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
                <span className="font-medium">{t('modal.schedule.active')}</span>
                <span className="text-muted-foreground block text-xs">
                  {t('modal.schedule.activeHint')}
                </span>
              </span>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                aria-label={t('modal.schedule.activeAria')}
              />
            </label>
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className="text-destructive hover:text-destructive w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" /> {t('modal.schedule.remove')}
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
                {editing ? t('modal.schedule.save') : t('modal.schedule.saveNew')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
