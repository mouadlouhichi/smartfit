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
import { useConfirm } from '../confirm-context';
import {
  BODY_UNIT_META,
  bodyDisplayUnit,
  bodyLabel,
  bodyValueToCanonical,
  bodyValueToDisplay,
  toISODate,
} from '@smartfit/core';
import type { BodyUnit } from '@smartfit/core';
import { Trash2 } from 'lucide-react';

/**
 * Measurements are stored canonically (kg / cm) and only converted at this
 * boundary, so switching units in Profile never rewrites history.
 */
export function BodyModal() {
  const { state, addBodyLog, deleteBodyLog } = useStore();
  const { closeModal } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('body');
  const open = payload !== null;
  const editing = payload?.log ?? null;

  const [date, setDate] = useState(toISODate(new Date()));
  const [unit, setUnit] = useState<BodyUnit>('weight');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(editing?.date ?? toISODate(new Date()));
    setUnit(editing?.unit ?? 'weight');
    setLabel(editing?.label ?? '');
    setValue(
      editing
        ? String(
            Math.round(bodyValueToDisplay(editing.value, editing.unit, state.profile) * 10) / 10,
          )
        : '',
    );
  }, [open, editing, state.profile]);

  const meta = BODY_UNIT_META[unit];
  const displayUnit = bodyDisplayUnit(unit, state.profile);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    // Editing a measurement replaces it: body logs are immutable points in time.
    if (editing) deleteBodyLog(editing.id);
    addBodyLog({
      date,
      unit,
      value: bodyValueToCanonical(Number(value), unit, state.profile),
      label: unit === 'custom' ? label.trim() || 'Measurement' : undefined,
    });
    setValue('');
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: 'Delete this measurement?',
      body: `The ${bodyLabel(editing.unit, editing.label).toLowerCase()} entry from ${editing.date} will be removed. This cannot be undone.`,
      confirmLabel: 'Delete entry',
      destructive: true,
    });
    if (!ok) return;
    deleteBodyLog(editing.id);
    closeModal();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit measurement' : 'Log a measurement'}</DialogTitle>
            <DialogDescription>
              Track body weight and measurements over time to see real progress. Your weight also
              personalises calorie estimates.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-date">Date</Label>
                <Input
                  id="b-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="b-unit">Measurement</Label>
                <Select
                  id="b-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as BodyUnit)}
                >
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
                <Input
                  id="b-label"
                  placeholder="e.g. Thigh"
                  value={label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="b-val">
                Value {displayUnit ? `(${displayUnit})` : meta.unit ? `(${meta.unit})` : ''}
              </Label>
              <Input
                id="b-val"
                type="number"
                // step="any": 0.1 rejected values like 79.95 kg / 88.88 cm.
                step="any"
                autoFocus
                placeholder="0.0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
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
              <Button type="submit">{editing ? 'Save' : 'Save measurement'}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
