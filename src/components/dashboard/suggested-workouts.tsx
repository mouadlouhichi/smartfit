'use client';

import { useMemo, useState } from 'react';
import { Sparkles, Play, Info, Dumbbell, Flame, Brain } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
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
  const { t } = useI18n();
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
      <Card className="border-volt/20 overflow-hidden">
        <div className="from-volt/[0.08] bg-gradient-to-br to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="bg-volt text-ink flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_4px_12px_-4px_rgba(138,210,0,0.5)]">
                <Brain className="h-5 w-5" />
              </span>
              {t('overview.suggested.title')}
              <Badge className="bg-volt text-ink ml-auto">{t('overview.suggested.badge')}</Badge>
            </CardTitle>
            <p className="text-muted-foreground text-xs">{t('overview.suggested.body')}</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suggestions.slice(0, 4).map((s) => (
              <div
                key={s.entry.name}
                className="group border-border bg-secondary/60 hover:border-volt/40 hover:bg-secondary flex items-center gap-3 rounded-[18px] border p-3.5 transition-all"
              >
                <ExerciseImage
                  name={s.entry.name}
                  className="border-border h-14 w-14 shrink-0 rounded-[12px] border"
                  animated={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[13px] font-bold tracking-tight">{s.entry.name}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {s.entry.equipment === 'pool'
                        ? t('overview.equipment.pool')
                        : s.entry.equipment === 'running'
                          ? t('overview.equipment.running')
                          : t('overview.equipment.gym')}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                    {s.reason}
                  </p>
                  <div className="mt-1.5 flex gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {exerciseMeasure(s.entry) === 'distance'
                        ? t('overview.measure.distance')
                        : t('overview.measure.strength')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-volt/30 text-volt-ink dark:text-volt-soft text-[10px]"
                    >
                      <Flame className="mr-1 h-3 w-3" /> {s.entry.muscles[0]}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button size="sm" onClick={() => start(s.entry)} className="rounded-full">
                    <Play className="h-3.5 w-3.5" /> {t('overview.suggested.start')}
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
