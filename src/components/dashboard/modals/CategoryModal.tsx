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
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { CategoryIcon, CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS } from '@/components/category-icon';
import { cn } from '@/lib/utils';

export function CategoryModal() {
  const { state, addCategory, deleteCategory } = useStore();
  const { open, closeModal } = useModals();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('activity');
  const [color, setColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory({ name: name.trim(), icon, color });
    setName('');
  }

  return (
    <Dialog open={open === 'category'} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activity types</DialogTitle>
          <DialogDescription>Categories group your workouts. Add your own.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          <div className="flex flex-wrap gap-2">
            {state.categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium"
              >
                <CategoryIcon name={c.icon} size={14} style={{ color: c.color }} />
                {c.name}
                {!c.builtin && (
                  <button
                    type="button"
                    onClick={() => deleteCategory(c.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${c.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          <form onSubmit={submit} className="mt-2 grid gap-3 rounded-xl border border-border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="c-name">New type</Label>
              <Input id="c-name" placeholder="e.g. Climbing" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                      icon === ic ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    <CategoryIcon name={ic} size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_COLOR_OPTIONS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColor(col)}
                    className={cn('h-8 w-8 rounded-full border-2', color === col ? 'border-foreground' : 'border-transparent')}
                    style={{ backgroundColor: col }}
                    aria-label={col}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" size="sm" className="justify-self-start">
              Add type
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={closeModal}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
