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
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Trash2, UtensilsCrossed } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { MEAL_SLOTS, hasProAccess, parseMealDescription, toISODate } from '@smartfit/core';
import type { MealSlot } from '@smartfit/core';

/**
 * Log / edit one meal. The star feature is the on-device meal scan: type what
 * you ate in plain words ("200g grilled chicken with rice and 2 eggs") and the
 * deterministic parser in @smartfit/core fills every field — no network, no
 * provider, works offline. Scan is the Pro perk; manual entry stays free.
 */
export function MealModal() {
  const { state, addMeal, updateMeal, deleteMeal } = useStore();
  const { closeModal, openWith } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('meal');
  const open = payload !== null;
  const editing = payload?.meal ?? null;
  const pro = hasProAccess(state);

  const [date, setDate] = useState(toISODate(new Date()));
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [scanText, setScanText] = useState('');
  const [matched, setMatched] = useState<string[]>([]);
  const [scanned, setScanned] = useState(false);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(editing?.date ?? payload?.date ?? toISODate(new Date()));
    setSlot(editing?.slot ?? payload?.slot ?? defaultSlotForNow());
    setName(editing?.name ?? '');
    setCalories(editing ? String(editing.calories) : '');
    setProtein(editing ? String(editing.protein) : '');
    setCarbs(editing?.carbs != null ? String(editing.carbs) : '');
    setFat(editing?.fat != null ? String(editing.fat) : '');
    setScanned(!!editing?.scanned);
    setMatched([]);
    setScanText('');
    setScanHint(null);
    setError(null);
  }, [open, editing, payload?.date, payload?.slot]);

  /** Guess the slot from the clock so the common case is zero taps. */
  function defaultSlotForNow(): MealSlot {
    const h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
  }

  function runScan() {
    if (!pro) {
      closeModal();
      openWith({ kind: 'pro' });
      return;
    }
    const text = scanText.trim();
    if (!text) {
      setScanHint('Describe the meal first, e.g. “2 eggs, khobz and a latte”.');
      return;
    }
    const scan = parseMealDescription(text);
    if (scan.empty) {
      setScanHint(
        'Nothing matched the food table yet — add amounts (“200g chicken”) or type the calories directly.',
      );
      return;
    }
    setScanHint(null);
    setMatched(scan.matched);
    setScanned(true);
    if (!name.trim()) setName(scan.name);
    setCalories(String(scan.calories));
    setProtein(String(scan.protein));
    setCarbs(String(scan.carbs));
    setFat(String(scan.fat));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const kcal = Number(calories);
    if (!name.trim()) {
      setError('Give the meal a name.');
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setError('Enter the calories (or use the scan).');
      return;
    }
    const prot = Number(protein);
    const record = {
      date,
      slot,
      name: name.trim().slice(0, 80),
      calories: Math.round(kcal),
      protein: Number.isFinite(prot) && prot > 0 ? Math.round(prot) : 0,
      carbs: carbs.trim() ? Math.max(0, Math.round(Number(carbs) || 0)) : undefined,
      fat: fat.trim() ? Math.max(0, Math.round(Number(fat) || 0)) : undefined,
      scanned: scanned || undefined,
    };
    if (editing) updateMeal(editing.id, record);
    else addMeal(record);
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: 'Delete this meal?',
      body: `“${editing.name}” from ${editing.date} will be removed from your fuel log. This cannot be undone.`,
      confirmLabel: 'Delete meal',
      destructive: true,
    });
    if (!ok) return;
    deleteMeal(editing.id);
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
                className="bg-volt-soft/25 text-volt-ink flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              >
                <UtensilsCrossed className="h-[22px] w-[22px]" />
              </span>
              <div className="min-w-0">
                <DialogTitle>{editing ? 'Edit meal' : 'Log a meal'}</DialogTitle>
                <DialogDescription>
                  Calories in, next to every calorie you burn. Describe what you ate and let the
                  scan do the math.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            {/* Meal scan — the Pro perk, on-device and offline. */}
            <div className="bg-secondary/50 rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                  <Sparkles className="text-volt-ink h-3.5 w-3.5" />
                  Meal scan
                  {!pro && (
                    <Badge variant="secondary" className="gap-1 normal-case">
                      <Crown className="h-3 w-3" /> Pro
                    </Badge>
                  )}
                </p>
                {scanned && <Badge variant="accent">Scanned</Badge>}
              </div>
              <div className="flex gap-2">
                <Input
                  value={scanText}
                  onChange={(e) => {
                    setScanText(e.target.value);
                    setScanHint(null);
                  }}
                  placeholder='e.g. "200g grilled chicken with rice and 2 eggs"'
                  aria-label="Describe what you ate"
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={runScan}>
                  Scan
                </Button>
              </div>
              {matched.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {matched.map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
              {scanHint && <p className="text-muted-foreground mt-2 text-xs">{scanHint}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="m-date" label="Date">
                <DatePicker
                  value={date}
                  onValueChange={setDate}
                  weekStartsOn={state.profile.weekStartsOn ?? 1}
                />
              </Field>
              <Field id="m-slot" label="Meal">
                <Select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                  {MEAL_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field id="m-name" label="Name" error={error ?? undefined}>
              <Input
                autoFocus
                placeholder="e.g. Chicken & rice"
                value={name}
                maxLength={80}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="m-kcal" label="Calories (kcal)">
                <Input
                  type="number"
                  min={1}
                  step="any"
                  placeholder="450"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  required
                />
              </Field>
              <Field id="m-protein" label="Protein (g)">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="35"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="m-carbs" label="Carbs (g) — optional">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="40"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
              </Field>
              <Field id="m-fat" label="Fat (g) — optional">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="12"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                />
              </Field>
            </div>
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
                {editing ? 'Save' : 'Save meal'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
