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
import { Field } from '@/components/ui/field';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import {
  CategoryIcon,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from '@/components/category-icon';
import { categoryUsage } from '@smartfit/core';
import { cn } from '@/lib/utils';

export function CategoryModal() {
  const { state, addCategory, deleteCategory } = useStore();
  const { t } = useI18n();
  const { closeModal } = useModals();
  const confirmDialog = useConfirm();
  const open = usePayload('category') !== null;
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [icon, setIcon] = useState<string>('activity');
  const [color, setColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t('modal.category.nameError'));
      return;
    }
    setNameError(null);
    addCategory({ name: name.trim(), icon, color });
    setName('');
  }

  /**
   * Deleting a type never deletes history. Sessions that referenced it fold
   * into "Other" in every chart, so we say so rather than silently dropping
   * them out of the mix.
   */
  async function remove(id: string, label: string) {
    const used = categoryUsage(state, id);
    const ok = await confirmDialog({
      title: t('modal.category.deleteTitle', { name: label }),
      body: used
        ? `${t('modal.category.usedBy', { name: label, count: used })} ${t('modal.category.deleteBody')}`
        : t('modal.category.deleteBodyBare'),
      confirmLabel: t('modal.category.deleteConfirm'),
      destructive: true,
    });
    if (!ok) return;
    deleteCategory(id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('modal.category.title')}</DialogTitle>
          <DialogDescription>{t('modal.category.blurb')}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          <div className="flex flex-wrap gap-2">
            {state.categories.map((c) => (
              <span
                key={c.id}
                className="border-border bg-secondary inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
              >
                <CategoryIcon name={c.icon} size={14} style={{ color: c.color }} />
                {c.name}
                {!c.builtin && (
                  <button
                    type="button"
                    onClick={() => remove(c.id, c.name)}
                    className="text-muted-foreground hover:text-destructive -my-2 -mr-2 ml-1 p-2"
                    aria-label={`Delete ${c.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          <form onSubmit={submit} className="border-border mt-2 grid gap-3 rounded-xl border p-3">
            <Field id="c-name" label={t('modal.category.new')} error={nameError}>
              <Input
                placeholder={t('modal.category.placeholder')}
                value={name}
                maxLength={40}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
              />
            </Field>
            <div className="grid gap-1.5">
              <Label>{t('modal.category.icon')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-lg border transition-colors sm:h-9 sm:w-9',
                      icon === ic
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    <CategoryIcon name={ic} size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('modal.category.color')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_COLOR_OPTIONS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColor(col)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2',
                      color === col ? 'border-foreground' : 'border-transparent',
                    )}
                    style={{ backgroundColor: col }}
                    aria-label={col}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" size="sm" className="justify-self-start">
              {t('modal.category.add')}
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={closeModal}>
            {t('action.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
