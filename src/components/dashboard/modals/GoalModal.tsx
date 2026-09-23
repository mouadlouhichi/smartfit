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
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { useI18n } from '@/lib/i18n-context';
import {
  GOAL_METRIC_META,
  deadlineLabel,
  fromKm,
  goalDeadline,
  suggestDeadline,
  toKm,
  toISODate,
} from '@smartfit/core';
import type { GoalCadence, GoalDeadline, GoalMetric } from '@smartfit/core';
import { CalendarClock, Trash2 } from 'lucide-react';

export function GoalModal() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore();
  const { t } = useI18n();
  const confirmDialog = useConfirm();
  const { closeModal } = useModals();
  const payload = usePayload('goal');
  const open = payload !== null;
  const editing = payload?.goal ?? null;

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('workouts');
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [target, setTarget] = useState('5');
  const [deadline, setDeadline] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);

  const distanceUnit = state.profile.distanceUnit;

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setMetric(editing?.metric ?? 'workouts');
    setCadence(editing?.cadence ?? 'weekly');
    // Distance is stored in km; show it in the user's unit.
    setTarget(
      editing
        ? String(
            editing.metric === 'distance'
              ? Math.round(fromKm(editing.target, distanceUnit) * 10) / 10
              : editing.target,
          )
        : '5',
    );
    setDeadline(editing?.deadline ?? '');
  }, [open, editing, distanceUnit]);

  const meta = GOAL_METRIC_META[metric];
  // The unit label the user types in — km/mi for distance, canonical otherwise.
  const targetUnit = metric === 'distance' ? distanceUnit : meta.unit;

  /**
   * What the deadline would mean, computed live from the fields above.
   *
   * Shown while the date is being chosen, because "does my current pace arrive
   * on time?" is the only question a deadline exists to answer — asking for a
   * date and staying silent about feasibility makes it a decoration.
   */
  const preview = useMemo(() => {
    if (!deadline) return null;
    const typed = Number(target);
    if (!Number.isFinite(typed) || typed <= 0) return null;
    return goalDeadline(
      state,
      {
        id: 'preview',
        name: name.trim() || meta.label,
        metric,
        cadence,
        target: metric === 'distance' ? toKm(typed, distanceUnit) : typed,
        startDate: editing?.startDate ?? toISODate(new Date()),
        deadline,
        createdAt: 0,
      },
      new Date(),
    );
  }, [
    deadline,
    target,
    metric,
    cadence,
    state,
    distanceUnit,
    editing?.startDate,
    name,
    meta.label,
  ]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const typed = Number(target);
    if (!Number.isFinite(typed) || typed <= 0) {
      setTargetError(t('modal.goal.targetError'));
      return;
    }
    setTargetError(null);
    const isoTarget = metric === 'distance' ? toKm(typed, distanceUnit) : typed;
    const record = {
      name: name.trim() || `${meta.label} goal`,
      metric,
      cadence,
      target: isoTarget,
      // A deadline needs to be a future date; anything earlier is either a
      // typo or history, and both are noise in the pace maths.
      deadline: deadline && deadline > toISODate(new Date()) ? deadline : undefined,
    };
    if (editing) updateGoal(editing.id, record);
    else addGoal({ ...record, startDate: toISODate(new Date()) });
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: t('modal.goal.deleteTitle'),
      body: `"${editing.name}" and its progress will be removed. This cannot be undone.`,
      confirmLabel: t('modal.goal.deleteConfirm'),
      destructive: true,
    });
    if (!ok) return;
    deleteGoal(editing.id);
    closeModal();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('modal.goal.title.edit') : t('modal.goal.title.new')}
            </DialogTitle>
            <DialogDescription>
              Goals persist across weeks and reset their progress each{' '}
              {cadence === 'weekly' ? 'week' : 'month'}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <Field id="g-name" label={t('modal.field.name')}>
              <Input
                placeholder={t('modal.goal.placeholder')}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="g-metric" label={t('modal.goal.track')}>
                <Select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
                  {Object.entries(GOAL_METRIC_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="g-cadence" label={t('modal.goal.reset')}>
                <Select value={cadence} onChange={(e) => setCadence(e.target.value as GoalCadence)}>
                  <option value="weekly">{t('modal.goal.weekly')}</option>
                  <option value="monthly">{t('modal.goal.monthly')}</option>
                </Select>
              </Field>
            </div>
            <Field id="g-target" label={`Target (${targetUnit})`} error={targetError}>
              <Input
                type="number"
                min={1}
                // step="any": metric steps (30 min, 250 kcal, 5 km) made the
                // browser reject perfectly sane targets — even the prefilled
                // default — and silently block the submit.
                step="any"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setTargetError(null);
                }}
              />
            </Field>
            <DeadlineField
              value={deadline}
              onChange={setDeadline}
              weekStartsOn={state.profile.weekStartsOn ?? 1}
              onSuggest={() => {
                const typed = Number(target);
                const base = Number.isFinite(typed) && typed > 0 ? typed : meta.step;
                setDeadline(
                  suggestDeadline(
                    state,
                    metric,
                    metric === 'distance' ? toKm(base, distanceUnit) : base,
                  ),
                );
              }}
              preview={preview}
              t={t}
            />
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
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
                {editing ? t('modal.goal.save') : t('modal.goal.create')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Deadline picker.
 *
 * Deliberately optional and clearly labelled as such: plenty of people train
 * against a cadence with no date in mind, and forcing a deadline on a "5 days
 * a week" goal would invent a commitment nobody made.
 *
 * `Field` takes exactly one control, so the date picker gets the label and the
 * Suggest/Clear actions sit next to it — with the live verdict underneath,
 * because "does my current pace arrive on time?" is the only question a
 * deadline exists to answer.
 */
function DeadlineField({
  value,
  onChange,
  weekStartsOn,
  onSuggest,
  preview,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  weekStartsOn: 0 | 1;
  onSuggest: () => void;
  preview: GoalDeadline | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="grid gap-1.5">
      <Field id="g-deadline" label={`${t('goal.deadline')}`} hint={t('goal.deadline.help')}>
        <DatePicker value={value} onValueChange={onChange} weekStartsOn={weekStartsOn} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSuggest}>
          <CalendarClock className="h-4 w-4" /> {t('goal.deadline.suggest')}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
            {t('modal.goal.clear')}
          </Button>
        )}
        {value && preview && (
          <p
            className={
              preview.verdict === 'behind' || preview.verdict === 'overdue'
                ? 'text-destructive text-xs font-bold'
                : 'text-volt-ink text-xs font-bold'
            }
          >
            {deadlineLabel(value)} — {preview.message}
          </p>
        )}
      </div>
    </div>
  );
}
