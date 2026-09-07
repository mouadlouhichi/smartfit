import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, RefreshCw, Trash2, UserRound, X } from 'lucide-react-native';
import { BODY_UNIT_META, latestBodyValue, toISODate, PLANS } from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button, Card, Input, Label } from '@/components/ui';

function BodyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addBodyLog } = useStore();
  const [unit, setUnit] = useState<'weight' | 'bodyfat' | 'waist'>('weight');
  const [value, setValue] = useState('');

  function save() {
    if (!value) return;
    addBodyLog({ date: toISODate(new Date()), unit, value: Number(value) });
    setValue('');
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background p-5">
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-lg font-bold text-foreground">Log measurement</Text>
          <Pressable onPress={onClose} className="rounded-full p-2 active:bg-muted">
            <X color="#857D75" size={22} />
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="gap-4 pt-4">
          <View>
            <Label>Measurement</Label>
            <View className="flex-row flex-wrap gap-2">
              {(['weight', 'bodyfat', 'waist'] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  className="rounded-full border px-3 py-2"
                  style={{ borderColor: unit === u ? '#D6532F' : '#E7E2DB', backgroundColor: unit === u ? '#D6532F22' : 'transparent' }}
                >
                  <Text style={{ color: unit === u ? '#D6532F' : '#857D75' }} className="text-sm font-medium">
                    {BODY_UNIT_META[u].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View>
            <Label>Value ({BODY_UNIT_META[unit].unit})</Label>
            <Input keyboardType="numeric" value={value} onChangeText={setValue} placeholder="0.0" />
          </View>
          <Button label="Save" onPress={save} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { state, updateProfile, clearData } = useStore();
  const [bodyOpen, setBodyOpen] = useState(false);
  const [name, setName] = useState(state.profile.name);

  const weight = latestBodyValue(state, 'weight');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <Text className="text-2xl font-bold text-foreground">Profile</Text>
        <Text className="text-sm text-muted-foreground">Your data stays on this device.</Text>

        <Card>
          <View className="mb-3 flex-row items-center gap-2">
            <UserRound color="#D6532F" size={18} />
            <Text className="font-semibold text-foreground">You</Text>
          </View>
          <Label>Name</Label>
          <Input value={name} onChangeText={setName} onBlur={() => updateProfile({ name })} placeholder="Your name" />
          <View className="mt-3">
            <Label>Strategy</Label>
            <Text className="rounded-xl border border-border bg-background p-3 text-sm text-foreground">
              {PLANS.find((p) => p.id === state.profile.planId)?.name}
            </Text>
          </View>
        </Card>

        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <Database color="#D6532F" size={18} />
            <Text className="font-semibold text-foreground">Your data</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            {state.sessions.length} workouts · {state.schedule.length} scheduled · {state.goals.length} goals ·{' '}
            {state.bodyLogs.length} measurements
          </Text>
          {weight != null && <Text className="mt-1 text-sm text-muted-foreground">Latest weight: {weight} kg</Text>}
          <View className="mt-4 gap-2">
            <Button label="Log measurement" variant="secondary" onPress={() => setBodyOpen(true)} />
            <Button
              label="Erase everything"
              variant="destructive"
              onPress={() =>
                Alert.alert('Erase data', 'Delete all SmartFit data on this device? This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Erase', style: 'destructive', onPress: clearData },
                ])
              }
            />
          </View>
        </Card>

        <View className="flex-row items-center justify-center gap-2 py-4">
          <RefreshCw color="#857D75" size={14} />
          <Text className="text-xs text-muted-foreground">Local-first · no account · no trackers</Text>
          <Trash2 color="#ffffff" size={1} />
        </View>
      </ScrollView>

      <BodyModal open={bodyOpen} onClose={() => setBodyOpen(false)} />
    </SafeAreaView>
  );
}
