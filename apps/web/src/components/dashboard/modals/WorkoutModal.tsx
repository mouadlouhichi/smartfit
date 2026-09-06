'use client';

import { useMemo, useState } from 'react';
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
import { INTENSITY_META } from '@smartfit/core';
import { estimateCalories, toISODate } from '@smartfit/core';
import type { Intensity, WorkoutExercise } from '@smartfit/core';

export function WorkoutModal() {
  const { state, addSession } = useStore();
  const { open, closeModal } = useModals();

  const [date, setDate] = useState(toISODate(new Date()));
  const [categoryId, setCategoryId] = useState('cat-strength');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('45');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([{ name: '', sets: [{}] }]);

  const cal = useMemo(
    () => estimateCalories(Number(duration) || 0, intensity),
    [duration, intensity],
  );

  const category = state.categories.find((c) => c.id === categoryId);
  const isCardio = categoryId === 'cat-cardio' || categoryId === 'cat-sports';

  function reset() {
    setTitle('');
    setDuration('45');
    setIntensity('moderate');
    setDistance('');
    setNotes('');
    setExercises([{ name: '', sets: [{}] }]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    addSession({
      date,
      categoryId,
      title: title.trim() || category?.name || 'Workout',
      durationMin: Math.max(1, Number(duration) || 0),
      intensity,
      calories: cal,
      distanceKm: isCardio && distance ? Number(distance) : undefined,
      exercises: exercises.filter((x) => x.name.trim()),
      notes: notes.trim() || undefined,
    });
    reset();
    closeModal();
  }

  return (
    <Dialog open={open === 'workout'} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log workout</DialogTitle>
            <DialogDescription>
              Every session you log feeds your weekly stats and streaks.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="w-date">Date</Label>
                <Input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="w-cat">Type</Label>
                <Select id="w-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="w-title">Title</Label>
              <Input
                id="w-title"
                placeholder={category?.name ?? 'Workout'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="w-dur">Minutes</Label>
                <Input id="w-dur" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="w-int">Intensity</Label>
                <Select
                  id="w-int"
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value as Intensity)}
                >
                  {Object.entries(INTENSITY_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              {isCardio ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="w-dist">km</Label>
                  <Input id="w-dist" type="number" step="0.1" min={0} value={distance} onChange={(e) => setDistance(e.target.value)} />
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label>Est. kcal</Label>
                  <div className="flex h-10 items-center rounded-xl border border-input bg-secondary px-3 text-sm font-semibold">
                    {cal}
                  </div>
                </div>
              )}
            </div>

            {isCardio ? (
              <div className="grid gap-1.5">
                <Label>Estimated burn</Label>
                <div className="flex h-10 items-center rounded-xl border border-input bg-secondary px-3 text-sm font-semibold">
                  {cal} kcal
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Exercises</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExercises((p) => [...p, { name: '', sets: [{}, {}] }])}
                  >
                    + Add
                  </Button>
                </div>
                <div className="grid gap-2">
                  {exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder={`Exercise ${i + 1} (e.g. Squat)`}
                        value={ex.name}
                        onChange={(e) =>
                          setExercises((p) => p.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                        }
                      />
                      <Input
                        className="w-20"
                        type="number"
                        placeholder="sets"
                        value={ex.sets.length}
                        min={1}
                        onChange={(e) =>
                          setExercises((p) =>
                            p.map((x, xi) =>
                              xi === i
                                ? { ...x, sets: Array.from({ length: Math.max(1, Number(e.target.value) || 1) }, () => ({})) }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="w-notes">Notes</Label>
              <Input id="w-notes" placeholder="How did it feel? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Save workout</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
