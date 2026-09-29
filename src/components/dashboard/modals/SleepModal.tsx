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
import { DatePicker } from '@/components/ui/date-picker';
import { Moon } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { toISODate } from '@smartfit/core';

export function SleepModal() {
  const { state, addSleepLog } = useStore();
  const { closeModal } = useModals();
  const payload = usePayload('sleep');
  const open = payload !== null;

  const [date, setDate] = useState(toISODate(new Date()));
  const [durationHours, setDurationHours] = useState('7');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [deep, setDeep] = useState('');
  const [rem, setRem] = useState('');
  const [light, setLight] = useState('');
  const [awake, setAwake] = useState('');
  const [quality, setQuality] = useState<number>(3);

  useEffect(() => {
    if (!open) return;
    setDate(toISODate(new Date()));
    setDurationHours('7');
    setDurationMinutes('30');
    setDeep('');
    setRem('');
    setLight('');
    setAwake('');
    setQuality(3);
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(durationHours) || 0;
    const m = Number(durationMinutes) || 0;
    const totalMin = Math.max(0, Math.round(h * 60 + m));
    if (totalMin <= 0) return;

    const stagesPresent = [deep, rem, light, awake].some((x) => x !== '' && Number(x) > 0);
    addSleepLog({
      date,
      durationMin: totalMin,
      source: 'manual',
      quality: quality as 1 | 2 | 3 | 4 | 5,
      stages: stagesPresent
        ? {
            deep: Math.max(0, Math.round(Number(deep) || 0)),
            rem: Math.max(0, Math.round(Number(rem) || 0)),
            light: Math.max(0, Math.round(Number(light) || 0)),
            awake: Math.max(0, Math.round(Number(awake) || 0)),
          }
        : undefined,
    });
    closeModal();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="flex items-start gap-3 pr-8">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-sm"
              >
                <Moon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle>Log sleep</DialogTitle>
                <DialogDescription>
                  Record last night&apos;s sleep. Stages are optional.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <Field id="s-date" label="Date (wake-up morning)">
              <DatePicker
                value={date}
                onValueChange={setDate}
                weekStartsOn={state.profile.weekStartsOn ?? 1}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="s-h" label="Hours">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </Field>
              <Field id="s-m" label="Minutes">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </Field>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                Sleep stages (optional, minutes)
              </p>
              <div className="grid grid-cols-4 gap-2">
                <MiniNum label="Deep" color="#4f46e5" value={deep} onChange={setDeep} />
                <MiniNum label="REM" color="#8b5cf6" value={rem} onChange={setRem} />
                <MiniNum label="Light" color="#6366f1" value={light} onChange={setLight} />
                <MiniNum label="Awake" color="#94a3b8" value={awake} onChange={setAwake} />
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                Subjective quality
              </p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuality(n)}
                    className={
                      'flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-bold transition ' +
                      (n <= quality
                        ? 'bg-indigo-500 text-white shadow'
                        : 'bg-secondary text-muted-foreground')
                    }
                    aria-label={`Quality ${n} of 5`}
                  >
                    {n === 1 ? '😴' : n === 2 ? '😐' : n === 3 ? '🙂' : n === 4 ? '😊' : '⚡'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Save sleep</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MiniNum({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-bold" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
