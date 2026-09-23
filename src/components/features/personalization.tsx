'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_TRAINING_PREFERENCES,
  generateStarterWeek,
  parseTrainingPreferences,
  STARTER_MOVEMENTS,
  type TrainingPreferences,
  type Weekday,
} from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { useConfirm } from '@/components/dashboard/confirm-context';
import { Button } from '@/components/ui/button';
import { DietPreferences } from './diet-preferences';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const control = 'bg-background mt-1 min-h-11 w-full rounded-xl border px-3';
export function Personalization() {
  const { state, updateProfile, replaceSchedule, flushWrites } = useStore();
  const confirm = useConfirm();
  const [prefs, setPrefs] = useState<TrainingPreferences>(
    state.profile.trainingPreferences ?? DEFAULT_TRAINING_PREFERENCES,
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  function patch<K extends keyof TrainingPreferences>(key: K, value: TrainingPreferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setNotice('');
  }
  let result: ReturnType<typeof generateStarterWeek> = { schedule: [], explanation: [] };
  try {
    result = generateStarterWeek(prefs);
  } catch {
    /* validation appears on save */
  }
  async function save(importWeek = false) {
    setError('');
    setNotice('');
    try {
      const valid = parseTrainingPreferences(prefs);
      if (
        importWeek &&
        !(await confirm({
          title: 'Replace your scheduled week?',
          body: 'This replaces scheduled sessions with this starter week. Completed workout history is not changed.',
          confirmLabel: 'Replace week',
        }))
      )
        return;
      setBusy(true);
      updateProfile({
        trainingPreferences: valid,
        ...(importWeek ? { weeklyRestDays: 7 - result.schedule.length } : {}),
      });
      if (importWeek) replaceSchedule(result.schedule);
      await flushWrites();
      setNotice(
        importWeek ? 'Preferences saved and starter week applied.' : 'Training preferences saved.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <header>
        <p className="text-primary text-xs font-bold tracking-widest uppercase">
          Assess → personalize → train
        </p>
        <h1 className="mt-2 text-3xl font-black">Training preferences</h1>
        <p className="text-muted-foreground mt-2">
          Choose what fits your week. These preferences stay private and sync with your personal
          account.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form
        className="bg-card space-y-5 rounded-2xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Primary goal
            <select
              aria-label="Primary goal"
              className={control}
              value={prefs.goal}
              onChange={(e) => patch('goal', e.target.value as TrainingPreferences['goal'])}
            >
              <option value="fitness">General fitness</option>
              <option value="strength">Strength</option>
              <option value="muscle">Build muscle</option>
            </select>
          </label>
          <label className="text-sm">
            Experience
            <select
              aria-label="Experience"
              className={control}
              value={prefs.experience}
              onChange={(e) =>
                patch('experience', e.target.value as TrainingPreferences['experience'])
              }
            >
              {['beginner', 'intermediate', 'advanced'].map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Training location
            <select
              aria-label="Training location"
              className={control}
              value={prefs.location}
              onChange={(e) => patch('location', e.target.value as TrainingPreferences['location'])}
            >
              {['home', 'gym', 'outdoors'].map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Time available
            <select
              aria-label="Time available"
              className={control}
              value={prefs.minutes}
              onChange={(e) =>
                patch('minutes', Number(e.target.value) as TrainingPreferences['minutes'])
              }
            >
              {[15, 20, 30, 45, 60].map((v) => (
                <option value={v} key={v}>
                  {v} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="mb-3 font-semibold">Available days (choose 1–6)</legend>
          <div className="flex flex-wrap gap-3">
            {days.map((label, i) => (
              <label
                key={label}
                className="bg-background flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={prefs.days.includes(i as Weekday)}
                  onChange={(e) =>
                    patch(
                      'days',
                      e.target.checked
                        ? [...prefs.days, i as Weekday]
                        : prefs.days.filter((d) => d !== i),
                    )
                  }
                />
                {label.slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 font-semibold">Available equipment</legend>
          <div className="flex gap-4">
            {(['bodyweight', 'dumbbells'] as const).map((v) => (
              <label key={v} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.equipment.includes(v)}
                  onChange={(e) =>
                    patch(
                      'equipment',
                      e.target.checked
                        ? [...prefs.equipment, v]
                        : prefs.equipment.filter((x) => x !== v),
                    )
                  }
                />
                {v === 'bodyweight' ? 'Bodyweight / no equipment' : 'Dumbbells'}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-semibold">Movement preferences</legend>
          <p className="text-muted-foreground mb-3 text-sm">
            These are comfort preferences, not injury treatment. The starter catalog contains no
            jumping.
          </p>
          <div className="flex flex-wrap gap-4">
            {(['no-floor', 'no-overhead'] as const).map((v) => (
              <label key={v} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.constraints.includes(v)}
                  onChange={(e) =>
                    patch(
                      'constraints',
                      e.target.checked
                        ? [...prefs.constraints, v]
                        : prefs.constraints.filter((x) => x !== v),
                    )
                  }
                />
                {v === 'no-floor' ? 'Avoid floor exercises' : 'Avoid overhead movement'}
              </label>
            ))}
          </div>
        </fieldset>
        <details>
          <summary className="cursor-pointer font-semibold">
            Exclude specific starter exercises
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {STARTER_MOVEMENTS.map((m) => (
              <label key={m.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.excludedExercises.includes(m.id)}
                  onChange={(e) =>
                    patch(
                      'excludedExercises',
                      e.target.checked
                        ? [...prefs.excludedExercises, m.id]
                        : prefs.excludedExercises.filter((x) => x !== m.id),
                    )
                  }
                />
                {m.name}
              </label>
            ))}
          </div>
        </details>
        <label className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 text-sm">
          <input
            type="checkbox"
            checked={prefs.needsClearance}
            className="mt-1"
            onChange={(e) => patch('needsClearance', e.target.checked)}
          />
          <span>
            I have pain, an injury, a medical concern, or have been advised to get professional
            clearance before exercise. Pause automatic suggestions.
          </span>
        </label>
        <Button disabled={busy}>Save preferences</Button>
      </form>
      <DietPreferences />
      <section className="bg-card space-y-4 rounded-2xl border p-5">
        <h2 className="text-xl font-bold">Your starter week preview</h2>
        <ul className="text-muted-foreground list-inside list-disc space-y-2 text-sm">
          {result.explanation.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {result.schedule.map((s) => (
          <div key={s.weekday} className="rounded-xl border p-4">
            <h3 className="font-semibold">
              {days[s.weekday]} · {s.title} · about {s.durationMin} min
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {s.exercises
                ?.map((e) => `${e.name} (${e.sets.length} × ${e.sets[0]?.reps})`)
                .join(' · ')}
            </p>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !result.schedule.length} onClick={() => void save(true)}>
            Apply starter week
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/plan">Open training plan</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
