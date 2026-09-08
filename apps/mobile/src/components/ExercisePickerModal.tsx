import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_MUSCLE_LABELS,
  searchExercises,
  type ExerciseCatalogEntry,
} from '@smartfit/core';
import { ExerciseDemo } from './ExerciseDemo';

/**
 * Searchable exercise library. Typing filters the shared catalog — pick a
 * movement and it lands in the log with its demonstration image attached
 * (via the name → catalog matcher).
 */
export function ExercisePickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchExercises(query, 24), [query]);

  function pick(entry: ExerciseCatalogEntry) {
    onPick(entry.name);
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="bg-background flex-1">
        <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
          <Text className="text-foreground text-lg font-bold">Exercise library</Text>
          <Pressable onPress={onClose} className="active:bg-muted rounded-full p-2">
            <X color="#857D75" size={22} />
          </Pressable>
        </View>

        <View className="border-border flex-row items-center gap-2 border-b px-5 pb-3">
          <Search color="#857D75" size={18} />
          <TextInput
            autoFocus
            placeholderTextColor="#A9A098"
            className="text-foreground flex-1 text-base"
            placeholder="Search exercises, muscles or equipment…"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <FlatList
          className="flex-1"
          contentContainerClassName="p-2"
          data={results}
          keyExtractor={(entry) => entry.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pick(item)}
              className="active:bg-muted flex-row items-center gap-3 rounded-xl px-3 py-2"
            >
              <ExerciseDemo name={item.name} size={44} animated={false} />
              <View className="flex-1">
                <Text className="text-foreground text-sm font-semibold">{item.name}</Text>
                <Text className="text-muted-foreground text-xs">
                  {EXERCISE_MUSCLE_LABELS[item.muscles[0]]} ·{' '}
                  {EXERCISE_EQUIPMENT_LABELS[item.equipment]}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text className="text-muted-foreground px-3 py-6 text-center text-sm">
              No match — close this and type your own exercise name instead.
            </Text>
          }
        />
      </View>
    </Modal>
  );
}
