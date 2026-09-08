'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { CategoryIcon } from '@/components/category-icon';
import {
  INTENSITY_META,
  categoryById,
  formatCalories,
  formatDateLabel,
  formatDistance,
  formatMinutes,
} from '@smartfit/core';
import { Clock, Flame, Info, Pencil, Route, StickyNote } from 'lucide-react';
import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseDetailDialog } from '@/components/exercise-detail';
import { matchExercise } from '@smartfit/core';
import { useExtendedCatalog } from '@/lib/use-extended-catalog';

/**
 * Read-only detail for a logged session.
 *
 * Everything the log captures is shown here — exercises, sets, notes and
 * distance — all of which used to be written to storage and never rendered
 * anywhere in the app.
 */
export function SessionDetailModal() {
  const { state } = useStore();
  const { closeModal, openWith } = useModals();
  const payload = usePayload('session-detail');
  const open = payload !== null;
  // More logged names become "known" (info + how-to) once the extended
  // runtime catalog loads — re-evaluate on that update.
  useExtendedCatalog();
  const session = payload?.session;
  const [detailName, setDetailName] = useState<string | null>(null);

  if (!session) {
    return <Dialog open={false} onOpenChange={() => undefined} />;
  }

  const category = categoryById(state, session.categoryId);
  const intensity = INTENSITY_META[session.intensity];
  const exercises = session.exercises ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${category.color}1f`, color: category.color }}
              >
                <CategoryIcon name={category.icon} size={20} />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate">{session.title}</DialogTitle>
                <p className="text-muted-foreground text-sm">
                  {formatDateLabel(session.date)} · {category.name}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat icon={<Clock className="h-4 w-4" />} label="Duration">
              {formatMinutes(session.durationMin)}
            </Stat>
            <Stat icon={<Flame className="h-4 w-4" />} label="Energy">
              {formatCalories(session.calories)}
            </Stat>
            {session.distanceKm !== undefined ? (
              <Stat icon={<Route className="h-4 w-4" />} label="Distance">
                {formatDistance(session.distanceKm, state.profile.distanceUnit)}
              </Stat>
            ) : (
              <Stat label="Intensity">
                <Badge variant="secondary" className="font-semibold">
                  {intensity.label}
                </Badge>
              </Stat>
            )}
          </div>

          {session.distanceKm !== undefined && (
            <p className="text-muted-foreground text-xs">
              Intensity: <span className="text-foreground font-medium">{intensity.label}</span>
            </p>
          )}

          {exercises.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">Exercises</h3>
              <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
                {exercises.map((ex, i) => {
                  const known = !!matchExercise(ex.name);
                  return (
                    <li
                      key={`${ex.name}-${i}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      {known ? (
                        <button
                          type="button"
                          onClick={() => setDetailName(ex.name)}
                          className="hover:bg-secondary -mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors"
                          title="How to do it"
                        >
                          <ExerciseImage name={ex.name} className="h-11 w-11 shrink-0 rounded-lg" />
                          <span className="text-foreground truncate text-sm font-medium">
                            {ex.name}
                          </span>
                          <Info className="text-muted-foreground h-4 w-4 shrink-0" />
                        </button>
                      ) : (
                        <span className="flex min-w-0 items-center gap-3">
                          <ExerciseImage name={ex.name} className="h-11 w-11 shrink-0 rounded-lg" />
                          <span className="truncate text-sm font-medium">{ex.name}</span>
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs">{describeSets(ex.sets)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {session.notes && (
            <div className="grid gap-1.5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <StickyNote className="text-muted-foreground h-4 w-4" /> Notes
              </h3>
              <p className="bg-secondary text-foreground/90 rounded-xl px-3 py-2.5 text-sm leading-relaxed">
                {session.notes}
              </p>
            </div>
          )}

          {exercises.length === 0 && !session.notes && (
            <p className="text-muted-foreground text-sm">
              No exercises or notes were recorded for this session.
            </p>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Close
            </Button>
            <Button type="button" onClick={() => openWith({ kind: 'workout', session })}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExerciseDetailDialog
        name={detailName}
        open={!!detailName}
        onOpenChange={(o) => !o && setDetailName(null)}
      />
    </>
  );
}

function describeSets(sets: { reps?: number; weightKg?: number }[]): string {
  if (!sets.length) return '—';
  const reps = sets.map((s) => s.reps).filter((r): r is number => typeof r === 'number');
  const count = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  if (!reps.length) return count;
  const same = reps.every((r) => r === reps[0]);
  return same ? `${sets.length} × ${reps[0]}` : `${count} · ${reps.join('/')}`;
}

function Stat({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border rounded-xl border px-3 py-2.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        {icon}
        {label}
      </span>
      <span className="mt-1 block text-sm font-bold">{children}</span>
    </div>
  );
}
