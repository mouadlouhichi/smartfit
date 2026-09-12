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
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { CategoryIcon } from '@/components/category-icon';
import {
  INTENSITY_META,
  type GeoPoint,
  categoryById,
  formatCalories,
  formatDateLabel,
  formatDistance,
  formatMinutes,
  formatSet,
  hasProAccess,
} from '@smartfit/core';
import { Clock, Flame, Info, Pencil, Route, Share2, StickyNote } from 'lucide-react';
import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseDetailDialog } from '@/components/exercise-detail';
import { matchExercise, toISODate } from '@smartfit/core';
import { useExtendedCatalog } from '@/lib/use-extended-catalog';
import { RouteMap } from '../route-map';
import { ShareSheet } from '../share-sheet';

/** Stable identity for sessions logged without a route (keeps memo keys warm). */
const EMPTY_ROUTE: GeoPoint[] = [];

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
  const [shareOpen, setShareOpen] = useState(false);

  if (!session) {
    return <Dialog open={false} onOpenChange={() => undefined} />;
  }

  const category = categoryById(state, session.categoryId);
  const intensity = INTENSITY_META[session.intensity];
  const exercises = session.exercises ?? [];
  const route = session.route?.length ? session.route : EMPTY_ROUTE;
  const isRun = route.length >= 2 || (session.splits?.length ?? 0) > 0;

  // Sessions logged before the run screen still deserve the new share card, so
  // the card is rebuilt from whatever the log holds: moving time when the run
  // screen recorded it, otherwise the logged duration.
  const movingSec = Math.round((session.movingTimeMin ?? session.durationMin) * 60);
  const distanceKm = session.distanceKm ?? 0;
  const dateLabel = formatDateLabel(session.date);

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
                {/* A dot + label instead of a Badge: the pill is wider than
                    an ~80px stat cell on phones. */}
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: intensity.color }}
                    aria-hidden
                  />
                  {intensity.label}
                </span>
              </Stat>
            )}
          </div>

          {session.distanceKm !== undefined && (
            <p className="text-muted-foreground text-xs">
              Intensity: <span className="text-foreground font-medium">{intensity.label}</span>
            </p>
          )}

          {/* The saved GPS trace, redrawn, with a Strava-style transparent share. */}
          {isRun && (
            <div className="bg-secondary/60 flex items-center gap-3 rounded-2xl p-3 min-[430px]:gap-4">
              <div className="bg-card h-20 w-20 shrink-0 overflow-hidden rounded-xl shadow-sm min-[430px]:h-24 min-[430px]:w-24">
                <RouteMap route={route} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Share card</p>
                <p className="text-muted-foreground text-xs">
                  Transparent, Volt or Ink — layer it over a photo for Instagram.
                </p>
              </div>
              <Button size="sm" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
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
                      <span className="text-muted-foreground shrink-0 text-right text-xs">
                        {describeSets(ex.sets, state.profile.weightUnit)}
                      </span>
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
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        watermark={!hasProAccess(state)}
        filename={`smartfit-run-${session.date}.png`}
        routeAvailable={route.length >= 2}
        data={{
          title: session.title,
          dateLabel,
          distanceKm,
          movingSec,
          paceMinPerKm: distanceKm > 0 ? movingSec / 60 / distanceKm : 0,
          elevationGainM: session.elevationGainM ?? 0,
          calories: session.calories,
          splits: session.splits,
          route,
        }}
      />
    </>
  );
}

function describeSets(sets: Parameters<typeof formatSet>[0][], unit: 'kg' | 'lb'): string {
  if (!sets.length) return '—';
  const count = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  const details = sets.map((set) => formatSet(set, unit)).filter((label) => label !== '—');
  if (details.length === 0) return count;
  const same = details.every((label) => label === details[0]);
  return same ? `${count} · ${details[0]}` : `${count} · ${details.join(' / ')}`;
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
    <div className="border-border min-w-0 rounded-xl border px-2 py-2.5 min-[430px]:px-3">
      <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase min-[430px]:text-[11px]">
        {icon && <span className="hidden shrink-0 min-[430px]:inline-flex">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-1 block truncate text-xs font-bold tabular-nums min-[430px]:text-sm">
        {children}
      </span>
    </div>
  );
}
