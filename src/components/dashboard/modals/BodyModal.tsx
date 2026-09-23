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
import { CategoryIcon, chipAccentStyle } from '@/components/category-icon';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import {
  BODY_UNIT_META,
  bodyDisplayUnit,
  bodyUnitLabel,
  bodyValueToCanonical,
  bodyValueToDisplay,
  formatDateLabel,
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
  const { t, locale } = useI18n();
  const { closeModal } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('body');
  const open = payload !== null;
  const editing = payload?.log ?? null;

  const [date, setDate] = useState(toISODate(new Date()));
  const [unit, setUnit] = useState<BodyUnit>('weight');
  const [value, setValue] = useState('');
  const [valueError, setValueError] = useState<string | null>(null);
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
  const accent = chipAccentStyle(undefined);
  const icon = meta?.icon ?? 'activity';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const typed = Number(value);
    if (!value.trim() || !Number.isFinite(typed) || typed <= 0) {
      setValueError(t('modal.body.valueError'));
      return;
    }
    setValueError(null);
    // Editing a measurement replaces it: body logs are immutable points in time.
    if (editing) deleteBodyLog(editing.id);
    addBodyLog({
      date,
      unit,
      value: bodyValueToCanonical(Number(value), unit, state.profile),
      label: unit === 'custom' ? label.trim() || t('modal.field.measurement') : undefined,
    });
    setValue('');
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: t('modal.body.deleteTitle'),
      body: t('modal.body.deleteBody', {
        metric: bodyUnitLabel(editing.unit, editing.label, t).toLowerCase(),
        date: formatDateLabel(editing.date, locale),
      }),
      confirmLabel: t('modal.body.deleteConfirm'),
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
            <div className="flex items-start gap-3 pr-8">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                style={accent}
              >
                <CategoryIcon name={icon} size={22} />
              </span>
              <div className="min-w-0">
                <DialogTitle>
                  {editing ? t('modal.body.title.edit') : t('modal.body.title.new')}
                </DialogTitle>
                <DialogDescription>{t('modal.body.blurb')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field id="b-date" label={t('modal.field.date')}>
                <DatePicker
                  value={date}
                  onValueChange={setDate}
                  weekStartsOn={state.profile.weekStartsOn ?? 1}
                />
              </Field>
              <Field id="b-unit" label={t('modal.field.measurement')}>
                <Select value={unit} onChange={(e) => setUnit(e.target.value as BodyUnit)}>
                  {Object.entries(BODY_UNIT_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon name={m.icon} size={12} className="text-muted-foreground" />
                        {bodyUnitLabel(k, undefined, t)}
                      </span>
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {unit === 'custom' && (
              <Field id="b-label" label={t('modal.field.name')}>
                <Input
                  placeholder={t('modal.field.nameThigh')}
                  value={label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
            )}

            <Field
              id="b-val"
              label={`Value ${displayUnit ? `(${displayUnit})` : meta.unit ? `(${meta.unit})` : ''}`}
              error={valueError}
            >
              <Input
                type="number"
                // step="any": 0.1 rejected values like 79.95 kg / 88.88 cm.
                step="any"
                autoFocus
                placeholder="0.0"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setValueError(null);
                }}
                required
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
                {editing ? t('modal.body.save') : t('modal.body.saveNew')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
