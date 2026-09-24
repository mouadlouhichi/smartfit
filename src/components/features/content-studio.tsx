'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  CONTENT_KINDS,
  PUBLICATION_STATES,
  validateContent,
  type ContentDraft,
  type TrainingContent,
} from '@smartfit/core';
import { Button } from '@/components/ui/button';
import { Artwork } from '@/components/ui/artwork';
import { trainingArtwork } from '@/lib/training-art';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFeatureData } from '@/lib/feature-client';
import { DEMO_CONTENT, EMPTY_CONTENT } from '@/lib/feature-demo';
import { FeatureShell } from './shell';
const control = 'border-input bg-field w-full rounded-xl border p-3 text-sm';
const split = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
export function ContentStudio() {
  const resource = useFeatureData(
    '/api/content?editorial=1',
    DEMO_CONTENT,
    'smartfit.demo.content',
  );
  const [selected, setSelected] = useState<TrainingContent | null>(null);
  const [draft, setDraft] = useState<ContentDraft>({ ...EMPTY_CONTENT });
  const [notice, setNotice] = useState('');
  const [equipmentText, setEquipmentText] = useState(EMPTY_CONTENT.equipment.join(', '));
  const [muscleText, setMuscleText] = useState(EMPTY_CONTENT.muscles.join(', '));
  const [validation, setValidation] = useState('');
  function patch<K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice('');
  }
  function edit(item: TrainingContent | null) {
    setSelected(item);
    setDraft(item ? { ...item } : { ...EMPTY_CONTENT });
    setEquipmentText((item ?? EMPTY_CONTENT).equipment.join(', '));
    setMuscleText((item ?? EMPTY_CONTENT).muscles.join(', '));
    setValidation('');
    setNotice('');
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setValidation('');
    setNotice('');
    try {
      const clean = validateContent({
        ...draft,
        equipment: split(equipmentText),
        muscles: split(muscleText),
        instructions: draft.instructions.filter((s) => s.trim()),
      });
      const ok = await resource.request(
        { id: selected?.id, version: selected?.version, draft: clean },
        () => {
          const item: TrainingContent = {
            ...clean,
            id: selected?.id ?? crypto.randomUUID(),
            version: (selected?.version ?? 0) + 1,
            createdAt: selected?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
            updatedBy: 'demo-editor',
          };
          return {
            ...resource.data,
            items: [item, ...resource.data.items.filter((i) => i.id !== item.id)],
          };
        },
      );
      if (ok) {
        edit(null);
        setNotice('Content saved. Published items are now available in the library.');
      }
    } catch (e) {
      setValidation(e instanceof Error ? e.message : 'Check your content.');
    }
  }
  const permitted =
    resource.mode === 'local' || ['content-manager', 'platform-admin'].includes(resource.data.role);
  return (
    <FeatureShell
      title="Content studio"
      description="Author, review, publish and archive training content. Every cloud save keeps an immutable revision."
      {...resource}
    >
      {!resource.error && permitted && (
        <>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => edit(null)}>
              New content
            </Button>
            <Button variant="outline" asChild>
              <Link href="/library">Preview published library</Link>
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-2" aria-label="Content entries">
              <p className="text-muted-foreground text-sm">Latest entries (up to 100)</p>
              {resource.data.items.length === 0 ? (
                <p>No content yet. Create your first draft.</p>
              ) : (
                resource.data.items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => edit(item)}
                    aria-pressed={selected?.id === item.id}
                    className="bg-card hover:border-primary w-full rounded-xl border p-4 text-left"
                  >
                    <span className="block font-bold">{item.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.kind} · {item.status} · v{item.version}
                    </span>
                  </button>
                ))
              )}
            </aside>
            <form onSubmit={save} className="bg-card space-y-4 rounded-2xl border p-5">
              <h2 className="text-xl font-bold">
                {selected ? `Edit revision ${selected.version}` : 'New draft'}
              </h2>
              {validation && (
                <p role="alert" className="text-destructive">
                  {validation}
                </p>
              )}
              {notice && (
                <p role="status" className="text-emerald-600">
                  {notice}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="studio-type" label="Type">
                  <Select
                    value={draft.kind}
                    onChange={(e) => patch('kind', e.target.value as ContentDraft['kind'])}
                  >
                    {CONTENT_KINDS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                        {v === 'challenge' ? ' (draft only)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="studio-status" label="Status">
                  <Select
                    value={draft.status}
                    onChange={(e) => patch('status', e.target.value as ContentDraft['status'])}
                  >
                    {PUBLICATION_STATES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <label className="block space-y-1 text-sm">
                Title
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  value={draft.title}
                  onChange={(e) => patch('title', e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                Description
                <textarea
                  className={control}
                  rows={3}
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) => patch('description', e.target.value)}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="studio-difficulty" label="Difficulty">
                  <Select
                    value={draft.difficulty}
                    onChange={(e) =>
                      patch('difficulty', e.target.value as ContentDraft['difficulty'])
                    }
                  >
                    {['beginner', 'intermediate', 'advanced'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="space-y-1 text-sm">
                  Duration (minutes)
                  <Input
                    type="number"
                    min={5}
                    max={180}
                    required
                    value={draft.durationMin}
                    onChange={(e) => patch('durationMin', Number(e.target.value))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  Equipment (comma-separated)
                  <Input value={equipmentText} onChange={(e) => setEquipmentText(e.target.value)} />
                </label>
                <label className="space-y-1 text-sm">
                  Muscles (comma-separated)
                  <Input value={muscleText} onChange={(e) => setMuscleText(e.target.value)} />
                </label>
              </div>
              <div className="space-y-3 rounded-xl border p-3">
                <Artwork src={trainingArtwork(draft)} className="h-36 w-full rounded-lg" />
                <label className="block space-y-1 text-sm">
                  Card cover image URL (HTTPS)
                  <Input
                    type="url"
                    maxLength={2048}
                    placeholder="https://…"
                    value={draft.coverUrl ?? ''}
                    onChange={(e) => patch('coverUrl', e.target.value)}
                  />
                </label>
                <p className="text-muted-foreground text-xs">
                  Use an image you have rights to publish. Leave empty for SmartFit artwork.
                </p>
              </div>
              <label className="block space-y-1 text-sm">
                Instructions (one step per line)
                <textarea
                  className={control}
                  rows={4}
                  value={draft.instructions.join('\n')}
                  onChange={(e) => patch('instructions', e.target.value.split('\n'))}
                />
              </label>
              <label className="block space-y-1 text-sm">
                Safety notes
                <textarea
                  className={control}
                  maxLength={1000}
                  value={draft.safetyNotes}
                  onChange={(e) => patch('safetyNotes', e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                Licensed demonstration video (HTTPS URL, optional)
                <Input
                  type="url"
                  value={draft.videoUrl}
                  onChange={(e) => patch('videoUrl', e.target.value)}
                />
              </label>
              <fieldset className="space-y-3 rounded-xl border p-4">
                <legend className="px-2 font-semibold">Workout exercises</legend>
                {draft.exercises.map((exercise, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <label className="min-w-40 flex-1 text-xs">
                      Exercise name
                      <Input
                        required
                        value={exercise.name}
                        onChange={(e) =>
                          patch(
                            'exercises',
                            draft.exercises.map((x, i) =>
                              i === index ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="w-20 text-xs">
                      Sets
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={exercise.sets.length}
                        onChange={(e) =>
                          patch(
                            'exercises',
                            draft.exercises.map((x, i) =>
                              i === index
                                ? {
                                    ...x,
                                    sets: Array.from(
                                      { length: Math.min(10, Math.max(1, Number(e.target.value))) },
                                      () => ({ reps: x.sets[0]?.reps ?? 8 }),
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="w-20 text-xs">
                      Reps
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={exercise.sets[0]?.reps ?? 8}
                        onChange={(e) =>
                          patch(
                            'exercises',
                            draft.exercises.map((x, i) =>
                              i === index
                                ? {
                                    ...x,
                                    sets: x.sets.map(() => ({ reps: Number(e.target.value) })),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove exercise ${index + 1}`}
                      onClick={() =>
                        patch(
                          'exercises',
                          draft.exercises.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={draft.exercises.length >= 30}
                  onClick={() =>
                    patch('exercises', [
                      ...draft.exercises,
                      { name: '', sets: [{ reps: 8 }, { reps: 8 }] },
                    ])
                  }
                >
                  Add exercise
                </Button>
              </fieldset>
              <p className="text-muted-foreground text-xs">
                Only publish material you have rights to use. All published items are free.
                Multi-week plan scheduling, challenge participation and premium gating are not
                enabled by this editor.
              </p>
              <Button type="submit" disabled={resource.busy}>
                {resource.busy ? 'Saving…' : 'Save revision'}
              </Button>
            </form>
          </div>
        </>
      )}
    </FeatureShell>
  );
}
