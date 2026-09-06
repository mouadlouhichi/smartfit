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
import { BODY_UNIT_META } from '@/lib/constants';
import { toISODate } from '@/lib/fitness';
import type { BodyUnit } from '@/lib/types';

export function BodyModal() {
  const { addBodyLog } = useStore();
  const { open, closeModal } = useModals();

  const [date, setDate] = useState(toISODate(new Date()));
  const [unit, setUnit] = useState<BodyUnit>('weight');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');

  const meta = BODY_UNIT_META[unit];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    addBodyLog({
      date,
      unit,
      value: Number(value),
      label: unit === 'custom' ? label.trim() || 'Measurement' : undefined,
    });
    setValue('');
    closeModal();
  }

  return (
    <Dialog open={open === 'body'} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log a measurement</DialogTitle>
            <DialogDescription>
              Track body weight and measurements over time to see real progress.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-date">Date</Label>
                <Input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="b-unit">Measurement</Label>
                <Select id="b-unit" value={unit} onChange={(e) => setUnit(e.target.value as BodyUnit)}>
                  {Object.entries(BODY_UNIT_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {unit === 'custom' && (
              <div className="grid gap-1.5">
                <Label htmlFor="b-label">Name</Label>
                <Input id="b-label" placeholder="e.g. Thigh" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="b-val">Value {meta.unit ? `(${meta.unit})` : ''}</Label>
              <Input
                id="b-val"
                type="number"
                step="0.1"
                autoFocus
                placeholder="0.0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Save measurement</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
