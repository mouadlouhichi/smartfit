'use client';

import { useState } from 'react';
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
import { useModals } from '../modal-context';
import { GOAL_METRIC_META } from '@smartfit/core';
import { toISODate } from '@smartfit/core';
import type { GoalCadence, GoalMetric } from '@smartfit/core';

export function GoalModal() {
  const { addGoal } = useStore();
  const { open, closeModal } = useModals();

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('workouts');
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [target, setTarget] = useState('5');

  const meta = GOAL_METRIC_META[metric];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    addGoal({
      name: name.trim() || `${meta.label} goal`,
      metric,
      cadence,
      target: Number(target) || 1,
      startDate: toISODate(new Date()),
    });
    setName('');
    closeModal();
  }

  return (
    <Dialog open={open === 'goal'} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Set a goal</DialogTitle>
            <DialogDescription>
              Goals persist across weeks and reset their progress each {cadence === 'weekly' ? 'week' : 'month'}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="g-name">Name</Label>
              <Input id="g-name" placeholder="e.g. Train 5 days a week" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="g-metric">Track</Label>
                <Select id="g-metric" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
                  {Object.entries(GOAL_METRIC_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="g-cadence">Reset</Label>
                <Select id="g-cadence" value={cadence} onChange={(e) => setCadence(e.target.value as GoalCadence)}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-target">Target ({meta.unit})</Label>
              <Input id="g-target" type="number" min={1} step={meta.step} value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Create goal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
