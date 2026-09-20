'use client';

import { useMemo, useState } from 'react';
import { Sparkles, Play, Info, Dumbbell, Flame, Brain } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { categoryIdForSuggestion, exerciseMeasure, suggestExercises } from '@smartfit/core';
import type { ExerciseCatalogEntry } from '@smartfit/core';
import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseDetailDialog } from '@/components/exercise-detail';

export function SuggestedWorkouts() {
  const { state } = useStore();
  const { openWith } = useModals();
  const [detail, setDetail] = useState<string | null>(null);

  const suggestions = useMemo(() => suggestExercises(state), [state]);

  function start(entry: ExerciseCatalogEntry) {
    openWith({
      kind: 'runner',
      title: entry.name,
      categoryId: categoryIdForSuggestion(state, entry.equipment),
      intensity: 'moderate',
      exercises: [{ name: entry.name, sets: [{}, {}, {}] }],
    });
  }

  if (suggestions.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden border-[#A8FF00]/20">
        <div className="bg-gradient-to-br from-[#A8FF00]/[0.08] to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#A8FF00] text-black shadow-[0_4px_12px_-4px_rgba(168,255,0,0.5)]">
                <Brain className="h-5 w-5" />
              </span>
              AI Suggested for you
              <Badge className="bg-volt text-ink ml-auto">AI Powered</Badge>
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Picked from your weight, body fat, waist and recent training — log measurements and
              these adapt.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suggestions.slice(0, 4).map((s) => (
              <div
                key={s.entry.name}
                className="group flex items-center gap-3 rounded-[18px] border border-white/[0.06] bg-[#151515] p-3.5 transition-all hover:border-[#A8FF00]/20 hover:bg-[#1a1a1a]"
              >
                <ExerciseImage
                  name={s.entry.name}
                  className="h-14 w-14 shrink-0 rounded-[12px] border border-white/[0.06]"
                  animated={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[13px] font-bold tracking-tight text-white">
                      {s.entry.name}
                    </p>
                    <Badge
                      variant="secondary"
                      className="bg-white/[0.08] text-[10px] text-white/60"
                    >
                      {s.entry.equipment === 'pool'
                        ? 'Pool'
                        : s.entry.equipment === 'running'
                          ? 'Running'
                          : 'Gym'}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">
                    {s.reason}
                  </p>
                  <div className="mt-1.5 flex gap-1">
                    <Badge variant="outline" className="border-white/[0.08] text-[10px]">
                      {exerciseMeasure(s.entry) === 'distance' ? 'Distance' : 'Strength'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-[#A8FF00]/20 text-[10px] text-[#A8FF00]/80"
                    >
                      <Flame className="mr-1 h-3 w-3" /> {s.entry.muscles[0]}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => start(s.entry)}
                    className="rounded-full bg-white text-black hover:bg-white/90"
                  >
                    <Play className="h-3.5 w-3.5" /> Start
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetail(s.entry.name)}
                    className="rounded-full"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </div>
      </Card>

      <ExerciseDetailDialog
        name={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </>
  );
}
