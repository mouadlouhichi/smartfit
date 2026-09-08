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
import { Switch } from '@/components/ui/switch';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { INTENSITY_META, WEEKDAYS_LONG } from '@smartfit/core';
import type { Intensity, Weekday } from '@smartfit/core';
import { Trash2 } from 'lucide-react';

export function ScheduleModal() {
  const { state, addSchedule, updateSchedule, deleteSchedule } = useStore();
  const { closeModal } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('schedule');
  const open = payload !== null;
  const editing = payload?.schedule ?? null;

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('cat-strength');
  const [weekday, setWeekday] = useState<Weekday>(1);
  const [time, setTime] = useState('07:00');
  const [duration, setDuration] = useState('45');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setCategoryId(editing?.categoryId ?? 'cat-strength');
    setWeekday(editing?.weekday ?? 1);
    setTime(editing?.timeOfDay ?? '07:00');
    setDuration(String(editing?.durationMin ?? 45));
    setIntensity(editing?.intensity ?? 'moderate');
    setActive(editing?.active ?? true);
  }, [open, editing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const record = {
      title: title.trim() || 'Scheduled session',
      categoryId,
      weekday,
      timeOfDay: time,
      durationMin: Math.max(5, Number(duration) || 45),
      intensity,
      active,
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
            <div className="grid gap-1.5">
              <Label htmlFor="s-title">Title</Label>
              <Input
                id="s-title"
                placeholder="e.g. Upper body"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-cat">Type</Label>
                <Select
                  id="s-cat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-day">Day</Label>
                <Select
                  id="s-day"
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
                >
                  {WEEKDAYS_LONG.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-time">Time</Label>
                <Input
                  id="s-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-dur">Minutes</Label>
                <Input
                  id="s-dur"
                  type="number"
                  min={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-int">Intensity</Label>
                <Select
                  id="s-int"
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value as Intensity)}
                >
                  {Object.entries(INTENSITY_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
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
