'use client';

import { useEffect, useState } from 'react';
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
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { GOAL_METRIC_META, fromKm, toKm, toISODate } from '@smartfit/core';
import type { GoalCadence, GoalMetric } from '@smartfit/core';
import { Trash2 } from 'lucide-react';

export function GoalModal() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore();
  const confirmDialog = useConfirm();
  const { closeModal } = useModals();
  const payload = usePayload('goal');
  const open = payload !== null;
  const editing = payload?.goal ?? null;

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('workouts');
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [target, setTarget] = useState('5');
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
  }, [open, editing, distanceUnit]);

  const meta = GOAL_METRIC_META[metric];
  // The unit label the user types in — km/mi for distance, canonical otherwise.
  const targetUnit = metric === 'distance' ? distanceUnit : meta.unit;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const typed = Number(target);
    if (!Number.isFinite(typed) || typed <= 0) {
      setTargetError('Enter a target bigger than zero.');
      return;
    }
    setTargetError(null);
    const record = {
      name: name.trim() || `${meta.label} goal`,
      metric,
      cadence,
      target: metric === 'distance' ? toKm(typed, distanceUnit) : typed,
    };
    if (editing) updateGoal(editing.id, record);
    else addGoal({ ...record, startDate: toISODate(new Date()) });
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: 'Delete this goal?',
      body: `"${editing.name}" and its progress will be removed. This cannot be undone.`,
      confirmLabel: 'Delete goal',
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
            <DialogTitle>{editing ? 'Edit goal' : 'Set a goal'}</DialogTitle>
            <DialogDescription>
              Goals persist across weeks and reset their progress each{' '}
              {cadence === 'weekly' ? 'week' : 'month'}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <Field id="g-name" label="Name">
              <Input
                placeholder="e.g. Train 5 days a week"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="g-metric" label="Track">
                <Select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
                  {Object.entries(GOAL_METRIC_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="g-cadence" label="Reset">
                <Select value={cadence} onChange={(e) => setCadence(e.target.value as GoalCadence)}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
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
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className="text-destructive hover:text-destructive w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" /> Delete
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
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editing ? 'Save goal' : 'Create goal'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
