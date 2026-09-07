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
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { GOAL_METRIC_META, fromKm, toKm, toISODate } from '@smartfit/core';
import type { GoalCadence, GoalMetric } from '@smartfit/core';
import { Trash2 } from 'lucide-react';

export function GoalModal() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore();
  const { closeModal } = useModals();
  const payload = usePayload('goal');
  const open = payload !== null;
  const editing = payload?.goal ?? null;

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('workouts');
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [target, setTarget] = useState('5');

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
    const typed = Number(target) || 1;
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

  function remove() {
    if (!editing) return;
    if (!confirm(`Delete "${editing.name}"?`)) return;
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
            <div className="grid gap-1.5">
              <Label htmlFor="g-name">Name</Label>
              <Input
                id="g-name"
                placeholder="e.g. Train 5 days a week"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="g-metric">Track</Label>
                <Select
                  id="g-metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as GoalMetric)}
                >
                  {Object.entries(GOAL_METRIC_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="g-cadence">Reset</Label>
                <Select
                  id="g-cadence"
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as GoalCadence)}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-target">Target ({targetUnit})</Label>
              <Input
                id="g-target"
                type="number"
                min={1}
                step={meta.step}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
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
              <Button type="submit">{editing ? 'Save goal' : 'Create goal'}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
