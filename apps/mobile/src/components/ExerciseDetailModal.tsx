import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Info, X } from 'lucide-react-native';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_MUSCLE_LABELS,
  matchExercise,
  type ExerciseUpstream,
} from '@smartfit/core';
import { loadExerciseUpstream } from '@/lib/exercise-instructions';
import { Card } from './ui';
import { ExerciseDemo } from './ExerciseDemo';

/**
 * "How do I do this?" sheet for any catalog exercise: the looping demo,
 * muscle/equipment chips and the step-by-step instructions from the open
 * dataset (fetched lazily and cached — see lib/exercise-instructions).
 */
export function ExerciseDetailModal({
  name,
  onClose,
}: {
  name: string | null;
  onClose: () => void;
}) {
  const entry = name ? matchExercise(name) : null;
  const [data, setData] = useState<ExerciseUpstream | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setData(null);
    setFailed(false);
    const pending = loadExerciseUpstream(name);
    if (!pending) return;
    pending.then((d) => !cancelled && setData(d)).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!entry) return null;

  const steps = data?.instructions ?? [];
  const level = typeof data?.level === 'string' ? data.level : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="bg-background flex-1">
        <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
          <Text className="text-foreground flex-1 text-lg font-bold" numberOfLines={1}>
            {entry.name}
          </Text>
          <Pressable onPress={onClose} className="active:bg-muted rounded-full p-2">
            <X color="#857D75" size={22} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-10">
          <View className="items-center gap-3">
            <ExerciseDemo name={entry.name} size={180} radius={16} />
            <View className="flex-row flex-wrap justify-center gap-2">
              {entry.muscles.map((m, i) => (
                <View
                  key={m}
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: i === 0 ? '#D6532F' : '#ECEAE6' }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: i === 0 ? '#FDF6F2' : '#4E4C4C' }}
                  >
                    {EXERCISE_MUSCLE_LABELS[m]}
                  </Text>
                </View>
              ))}
              <View className="rounded-full bg-[#ECEAE6] px-2.5 py-1">
                <Text className="text-xs font-semibold" style={{ color: '#4E4C4C' }}>
                  {EXERCISE_EQUIPMENT_LABELS[entry.equipment]}
                </Text>
              </View>
              {level ? (
                <View className="rounded-full bg-[#ECEAE6] px-2.5 py-1">
                  <Text className="text-xs font-semibold" style={{ color: '#4E4C4C' }}>
                    {level}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              How to do it
            </Text>
            {!data && !failed && (
              <View className="flex-row items-center gap-2 py-4">
                <ActivityIndicator color="#D6532F" />
                <Text className="text-muted-foreground text-sm">Loading instructions…</Text>
              </View>
            )}
            {failed && (
              <Card>
                <Text className="text-muted-foreground text-sm">
                  Couldn’t load the instructions — check your connection and reopen.
                </Text>
              </Card>
            )}
            {data && steps.length === 0 && (
              <Text className="text-muted-foreground text-sm">
                No step-by-step guide recorded for this exercise.
              </Text>
            )}
            {steps.map((step, i) => (
              <View key={i} className="flex-row gap-3 py-1">
                <View
                  className="h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: '#F6D9CE' }}
                >
                  <Text className="text-xs font-bold" style={{ color: '#8A3418' }}>
                    {i + 1}
                  </Text>
                </View>
                <Text className="text-foreground/90 flex-1 text-sm leading-relaxed">{step}</Text>
              </View>
            ))}
            <View className="flex-row items-center justify-center gap-1 pt-2">
              <Info color="#A9A098" size={12} />
              <Text className="text-muted-foreground text-center text-xs">
                Demo &amp; steps from the open free-exercise-db dataset (Unlicense)
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
