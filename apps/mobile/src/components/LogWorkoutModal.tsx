import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Button, Card, Input, Label } from './ui';
import {
  estimateCalories,
  fromKm,
  latestBodyWeightKg,
  relativeDay,
  toISODate,
  toKm,
  INTENSITY_META,
} from '@smartfit/core';
import type { Intensity } from '@smartfit/core';
import { useStore } from '@/lib/store';

const INTENSITIES: Intensity[] = ['low', 'moderate', 'high'];

/** The last week of dates, most recent first — enough to catch up a missed log. */
function recentDates(count = 7): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}

export function LogWorkoutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addSession } = useStore();
  const [date, setDate] = useState(toISODate(new Date()));
  const [categoryId, setCategoryId] = useState('cat-strength');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('45');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [distance, setDistance] = useState('');

  const category = state.categories.find((c) => c.id === categoryId);
  const isCardio = categoryId === 'cat-cardio' || categoryId === 'cat-sports';
  // Personalised by the most recent body weight, exactly like the web app.
  const calories = estimateCalories(
    Number(duration) || 0,
    intensity,
    latestBodyWeightKg(state) ?? undefined,
  );
  const distanceUnit = state.profile.distanceUnit ?? 'km';
  const dates = recentDates();

  function save() {
    addSession({
      date,
      categoryId,
      title: title.trim() || category?.name || 'Workout',
      durationMin: Math.max(1, Number(duration) || 0),
      intensity,
      calories,
      distanceKm: isCardio && distance ? toKm(Number(distance), distanceUnit) : undefined,
      exercises: [],
    });
    setTitle('');
    setDistance('');
    setDate(toISODate(new Date()));
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View className="bg-background flex-1">
        <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
          <Text className="text-foreground text-lg font-bold">Log workout</Text>
          <Pressable onPress={onClose} className="active:bg-muted rounded-full p-2">
            <X color="#857D75" size={22} />
          </Pressable>
        </View>
        <ScrollView className="flex-1 p-5" contentContainerClassName="gap-4">
          <View>
            <Label>When</Label>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {dates.map((d) => {
                const selected = d === date;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDate(d)}
                    className="rounded-full border px-3 py-2"
                    style={{
                      borderColor: selected ? '#D6532F' : '#E7E2DB',
                      backgroundColor: selected ? '#D6532F14' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: selected ? '#D6532F' : '#857D75' }}
                    >
                      {relativeDay(d)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View>
            <Label>Title</Label>
            <Input placeholder="e.g. Push day" value={title} onChangeText={setTitle} />
          </View>

          <View>
            <Label>Type</Label>
            <View className="flex-row flex-wrap gap-2">
              {state.categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  className="rounded-full border px-3 py-2"
                  style={{
                    borderColor: categoryId === c.id ? c.color : '#E7E2DB',
                    backgroundColor: categoryId === c.id ? `${c.color}14` : 'transparent',
                  }}
                >
                  <Text
                    style={{ color: categoryId === c.id ? c.color : '#857D75' }}
                    className="text-sm font-medium"
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Label>Minutes</Label>
              <Input keyboardType="numeric" value={duration} onChangeText={setDuration} />
            </View>
            {isCardio ? (
              <View className="flex-1">
                <Label>Distance ({distanceUnit})</Label>
                <Input
                  keyboardType="numeric"
                  value={distance}
                  onChangeText={setDistance}
                  placeholder="0.0"
                />
              </View>
            ) : null}
          </View>

          <View>
            <Label>Intensity</Label>
            <View className="flex-row gap-2">
              {INTENSITIES.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setIntensity(k)}
                  className="flex-1 rounded-full border px-3 py-2"
                  style={{
                    borderColor: intensity === k ? INTENSITY_META[k].color : '#E7E2DB',
                    backgroundColor:
                      intensity === k ? `${INTENSITY_META[k].color}14` : 'transparent',
                  }}
                >
                  <Text
                    className="text-center text-sm font-medium"
                    style={{ color: intensity === k ? INTENSITY_META[k].color : '#857D75' }}
                  >
                    {INTENSITY_META[k].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Card className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">Estimated burn</Text>
            <Text className="text-primary text-base font-bold">{calories} kcal</Text>
          </Card>

          <Button label="Save workout" onPress={save} />
        </ScrollView>
      </View>
    </Modal>
  );
}
