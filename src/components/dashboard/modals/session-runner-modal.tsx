'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, Flag, Minus, Pause, Play, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useToast } from '@/components/ui/toast';
import { categoryById, toISODate } from '@smartfit/core';
import { cn } from '@/lib/utils';

import { categoryArt } from '@/lib/category-art';

interface RunnerExercise {
  id: number;
  name: string;
  sets: number;
}

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Live session runner — "start exercise". Glanceable by design: the running
 * clock and the current exercise are the only things above the fold, controls
 * sit in the thumb zone, and finishing logs the session with the real
 * duration and the sets you actually ticked off.
 */
export function SessionRunnerModal() {
  const { state, addSession, estimateSessionCalories } = useStore();
  const { open, payload, closeModal } = useModals();
  const toast = useToast();

  const isOpen = open === 'runner' && payload?.kind === 'runner';
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [exercises, setExercises] = useState<RunnerExercise[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(1);

  // Fresh session every time the runner opens.
  useEffect(() => {
    if (isOpen) {
      setSeconds(0);
      setRunning(false);
      setRestLeft(0);
      setExercises([]);
      setDraft('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (restLeft <= 0) return;
    const t = setInterval(() => setRestLeft((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [restLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !payload || payload.kind !== 'runner') return null;
  // Captured after the guard so hoisted helpers below see the narrow type.
  const run = payload;

  const category = categoryById(state, run.categoryId);
  const art = categoryArt(run.categoryId) ?? '/images/cat-rest.jpg';

  function addExercise() {
    const name = draft.trim();
    if (!name) return;
    setExercises((xs) => [...xs, { id: nextId.current++, name, sets: 0 }]);
    setDraft('');
  }

  function bump(id: number, delta: number) {
    setExercises((xs) =>
      xs.map((x) => (x.id === id ? { ...x, sets: Math.max(0, x.sets + delta) } : x)),
    );
  }

  function finish() {
    const durationMin = Math.max(1, Math.round(seconds / 60));
    addSession({
      date: toISODate(new Date()),
      categoryId: run.categoryId,
      title: run.title,
      durationMin,
      intensity: run.intensity,
      calories: estimateSessionCalories(durationMin, run.intensity),
      exercises: exercises
        .filter((x) => x.sets > 0)
        .map((x) => ({ name: x.name, sets: Array.from({ length: x.sets }, () => ({})) })),
      scheduleId: run.scheduleId,
    });
    setRunning(false);
    closeModal();
    toast(`Session logged — ${durationMin} min of ${run.title}`);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) {
          setRunning(false);
          closeModal();
        }
      }}
    >
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-optimised asset */}
          <img src={art} alt="" className="h-32 w-full object-cover" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
            <div>
              <DialogTitle className="text-lg leading-tight text-white">{run.title}</DialogTitle>
              <DialogDescription className="text-xs text-white/75">
                {category?.name ?? 'Session'} · live session
              </DialogDescription>
            </div>
            <p
              className="font-display text-4xl font-extrabold text-white tabular-nums drop-shadow-lg"
              aria-label="Elapsed time"
            >
              {clock(seconds)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-5">
          {/* Rest timer chip */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestLeft(restLeft > 0 ? 0 : 60)}
              className={cn(restLeft > 0 && 'border-primary text-primary')}
            >
              <Coffee className="h-4 w-4" />
              {restLeft > 0 ? `Resting ${clock(restLeft)}` : 'Rest 60s'}
            </Button>
            {restLeft > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setRestLeft((r) => r + 30)}>
                +30s
              </Button>
            )}
          </div>

          {/* Exercise checklist with set counters */}
          <div className="grid gap-2">
            {exercises.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Add the exercises as you go — tap + for every set you complete.
              </p>
            )}
            {exercises.map((x) => (
              <div key={x.id} className="bg-secondary flex items-center gap-2 rounded-xl px-3 py-2">
                <span className="flex-1 truncate text-sm font-semibold">{x.name}</span>
                <span className="text-muted-foreground text-xs font-bold tabular-nums">
                  {x.sets} set{x.sets === 1 ? '' : 's'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => bump(x.id, -1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => bump(x.id, 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExercise()}
                placeholder="Add exercise (e.g. Bench press)"
                className="h-9 flex-1"
              />
              <Button variant="outline" size="sm" className="h-9" onClick={addExercise}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {/* Thumb-zone controls */}
          <div className="flex gap-2">
            <Button
              variant={running ? 'outline' : 'default'}
              className="h-12 flex-1"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? 'Pause' : seconds > 0 ? 'Resume' : 'Start'}
            </Button>
            <Button className="h-12 flex-1" onClick={finish}>
              <Flag className="h-4 w-4" /> Finish session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
