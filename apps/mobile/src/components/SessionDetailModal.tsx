import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import {
  INTENSITY_META,
  formatCalories,
  formatDateLabel,
  formatDistance,
  formatMinutes,
  type WorkoutSession,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Badge, Card } from './ui';
import { CategoryIcon } from './CategoryIcon';
import { ExerciseDemo } from './ExerciseDemo';

/** Compact set summary for an exercise row, e.g. "3 × 8-10" or "4 sets". */
function describeSets(sets: { reps?: number; weight?: number }[]): string {
  if (sets.length === 0) return '';
  const reps = sets.map((s) => s.reps).filter((r): r is number => typeof r === 'number');
  if (reps.length === 0) return `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  const unique = [...new Set(reps)];
  const range =
    unique.length === 1 ? `${unique[0]}` : `${Math.min(...unique)}-${Math.max(...unique)}`;
  return `${sets.length} × ${range}`;
}

/**
 * Read-only session detail: what was done, for how long, at what intensity
 * — with the logged exercises illustrated by their demonstration loops.
 */
export function SessionDetailModal({
  session,
  onClose,
}: {
  session: WorkoutSession | null;
  onClose: () => void;
}) {
  const { state, deleteSession } = useStore();
  if (!session) return null;

  const category = state.categories.find((c) => c.id === session.categoryId);
  const meta = INTENSITY_META[session.intensity];
  const exercises = session.exercises ?? [];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="bg-background flex-1">
        <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
          <Text className="text-foreground text-lg font-bold">{session.title}</Text>
          <Pressable onPress={onClose} className="active:bg-muted rounded-full p-2">
            <X color="#857D75" size={22} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-10">
          <View className="flex-row items-center gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${category?.color ?? '#64748b'}1a` }}
            >
              <CategoryIcon
                name={category?.icon ?? 'activity'}
                color={category?.color ?? '#64748b'}
                size={20}
              />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold">{category?.name ?? 'Workout'}</Text>
              <Text className="text-muted-foreground text-sm">
                {formatDateLabel(session.date)} · {meta.label} intensity
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Badge color="#0EA5E9">{formatMinutes(session.durationMin)}</Badge>
            <Badge color="#F59E0B">{formatCalories(session.calories)}</Badge>
            {session.distanceKm !== undefined && (
              <Badge color="#8B5CF6">{formatDistance(session.distanceKm)}</Badge>
            )}
          </View>

          {exercises.length > 0 && (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Exercises
              </Text>
              <Card className="gap-3">
                {exercises.map((ex, i) => (
                  <View key={`${ex.name}-${i}`} className="flex-row items-center gap-3">
                    <ExerciseDemo name={ex.name} size={48} />
                    <View className="flex-1">
                      <Text className="text-foreground text-sm font-semibold">{ex.name}</Text>
                      <Text className="text-muted-foreground text-xs">{describeSets(ex.sets)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {session.notes ? (
            <View className="gap-2">
              <Text className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Notes
              </Text>
              <Card>
                <Text className="text-foreground/90 text-sm leading-relaxed">{session.notes}</Text>
              </Card>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              deleteSession(session.id);
              onClose();
            }}
            className="active:bg-muted flex-row items-center justify-center gap-2 rounded-full border border-red-200 py-3"
            style={{ borderColor: '#FECACA' }}
          >
            <Trash2 color="#DC2626" size={18} />
            <Text className="text-sm font-semibold" style={{ color: '#DC2626' }}>
              Delete workout
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
