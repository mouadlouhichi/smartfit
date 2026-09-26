'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { TrainingContent } from '@smartfit/core';
import { Button } from '@/components/ui/button';
import { Artwork, WorkspaceIllustration } from '@/components/ui/artwork';
import { trainingArtwork } from '@/lib/training-art';
import { safeImageUrl } from '@/lib/gym-profile';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useFeatureData } from '@/lib/feature-client';
import { DEMO_CONTENT } from '@/lib/feature-demo';
import { FeatureShell } from './shell';
import { useModals } from '@/components/dashboard/modal-context';
export function MemberTrainingLibrary() {
  const { openWith } = useModals();
  return (
    <TrainingLibrary
      onStart={(item) =>
        openWith({
          kind: 'runner',
          title: item.title,
          categoryId: 'cat-strength',
          intensity:
            item.difficulty === 'advanced'
              ? 'high'
              : item.difficulty === 'beginner'
                ? 'low'
                : 'moderate',
          exercises: structuredClone(item.exercises),
        })
      }
    />
  );
}
export function TrainingLibrary({ onStart }: { onStart?: (item: TrainingContent) => void }) {
  const resource = useFeatureData('/api/content', DEMO_CONTENT, 'smartfit.demo.content', true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [detail, setDetail] = useState<string | null>(null);
  const published = resource.data.items.filter((i) => i.status === 'published');
  const visible = published.filter(
    (i) =>
      (kind === 'all' || i.kind === kind) &&
      (difficulty === 'all' || i.difficulty === difficulty) &&
      (equipment === 'all' || i.equipment.includes(equipment)) &&
      `${i.title} ${i.description} ${i.muscles.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <FeatureShell
      title="Find your next session"
      description="Explore published training content. Preview freely, then use your personal workout player to train and keep your history."
      {...resource}
    >
      {!resource.error && (
        <>
          {/* One `Field` per filter, so labels are wired with htmlFor and every
              control is the same height and boundary. */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Field id="lib-search" label="Search">
              <Input
                type="search"
                placeholder="Name or muscle group"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field id="lib-kind" label="Content type">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="all">All types</option>
                <option value="exercise">Exercise</option>
                <option value="workout">Workout</option>
                <option value="plan">Plan</option>
              </Select>
            </Field>
            <Field id="lib-difficulty" label="Difficulty">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="all">All levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
            <Field id="lib-equipment" label="Equipment">
              <Select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                <option value="all">Any equipment</option>
                {[...new Set(published.flatMap((i) => i.equipment))].sort().map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p role="status" className="text-muted-foreground text-sm">
            {visible.length} result{visible.length === 1 ? '' : 's'} · published catalog (up to 100
            entries)
          </p>
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <WorkspaceIllustration className="mx-auto" />
              <h2 className="font-bold">No matching content yet</h2>
              <p className="text-muted-foreground mt-2">
                Try another filter, or come back after your content team publishes a session.
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((item) => (
              <article
                key={item.id}
                className="group bg-card overflow-hidden rounded-3xl border shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="relative h-52 overflow-hidden">
                  <Artwork
                    src={trainingArtwork(item)}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-black">
                    {item.kind}
                  </span>
                  <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between text-white">
                    <span className="text-sm font-semibold">{item.durationMin} minute session</span>
                    {!safeImageUrl(item.coverUrl) && (
                      <span className="text-[10px]">SmartFit artwork</span>
                    )}
                  </div>
                </div>
                <div className="space-y-4 p-6">
                  <p className="text-primary text-xs font-bold tracking-wider uppercase">
                    {item.kind} · {item.difficulty} · Free
                  </p>
                  <h2 className="text-xl font-bold">{item.title}</h2>
                  <p className="text-muted-foreground">{item.description}</p>
                  <p className="text-sm">
                    {item.durationMin} min · {item.equipment.join(', ') || 'No equipment specified'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      aria-expanded={detail === item.id}
                      onClick={() => setDetail(detail === item.id ? null : item.id)}
                    >
                      View details
                    </Button>
                    {item.exercises.length > 0 &&
                      (onStart ? (
                        <Button onClick={() => onStart(item)}>Start session</Button>
                      ) : (
                        <Button asChild>
                          <Link href="/login?next=%2Fdashboard%2Flibrary">Train with SmartFit</Link>
                        </Button>
                      ))}
                  </div>
                  {detail === item.id && (
                    <div className="space-y-3 border-t pt-4">
                      <ol className="list-inside list-decimal space-y-2 text-sm">
                        {item.instructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      {item.exercises.length > 0 && (
                        <ul className="space-y-1 text-sm">
                          {item.exercises.map((exercise, i) => (
                            <li key={i}>
                              {exercise.name} · {exercise.sets.length} sets ·{' '}
                              {exercise.sets[0]?.reps} reps
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.safetyNotes && (
                        <p className="rounded-xl bg-amber-500/10 p-3 text-sm">{item.safetyNotes}</p>
                      )}
                      {item.videoUrl && (
                        <a
                          className="text-primary underline"
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open demonstration video
                        </a>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Revision {item.version}. Starting copies this routine into your player;
                        future library edits do not change an active session.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </FeatureShell>
  );
}
