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
import { INTENSITY_META, WEEKDAYS_LONG } from '@smartfit/core';
import type { Intensity, Weekday } from '@smartfit/core';

export function ScheduleModal() {
  const { state, addSchedule } = useStore();
  const { open, closeModal } = useModals();

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('cat-strength');
  const [weekday, setWeekday] = useState<Weekday>(1);
  const [time, setTime] = useState('07:00');
  const [duration, setDuration] = useState('45');
  const [intensity, setIntensity] = useState<Intensity>('moderate');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    addSchedule({
      title: title.trim() || 'Scheduled session',
      categoryId,
      weekday,
      timeOfDay: time,
      durationMin: Math.max(5, Number(duration) || 45),
      intensity,
      active: true,
    });
    setTitle('');
    closeModal();
  }

  return (
    <Dialog open={open === 'schedule'} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Schedule a recurring session</DialogTitle>
            <DialogDescription>
              Planned sessions repeat every week — your training plan, on autopilot.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="s-title">Title</Label>
              <Input id="s-title" placeholder="e.g. Push day" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-cat">Type</Label>
                <Select id="s-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
                <Input id="s-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-dur">Minutes</Label>
                <Input id="s-dur" type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-int">Intensity</Label>
                <Select id="s-int" value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)}>
                  {Object.entries(INTENSITY_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Add to plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
