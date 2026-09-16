import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown, Database, RefreshCw, UserRound, X } from 'lucide-react-native';
import {
  BODY_UNIT_META,
  PRO_PLANS,
  hasProAccess,
  isTrialing,
  latestBodyValue,
  toISODate,
  trialDaysLeft,
  PLANS,
} from '@smartfit/core';
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
      <View className="bg-background flex-1 p-5">
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-foreground text-lg font-bold">Log measurement</Text>
          <Pressable onPress={onClose} className="active:bg-muted rounded-full p-2">
            <X color="#a3a3a3" size={22} />
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
                  style={{
                    borderColor: unit === u ? '#9cff00' : '#2b2b2b',
                    backgroundColor: unit === u ? '#9cff0022' : 'transparent',
                  }}
                >
                  <Text
                    style={{ color: unit === u ? '#9cff00' : '#a3a3a3' }}
                    className="text-sm font-medium"
                  >
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

/**
 * Pro membership status. Checkout lives in the web app for now (native
 * in-app purchase via RevenueCat is the follow-up) — but the stamp is read
 * here so gates stay consistent the moment mobile enforces them, and members
 * see their status instead of a second paywall.
 */
function ProCard() {
  const { state } = useStore();
  const pro = hasProAccess(state);
  const trialing = isTrialing(state);
  const planName = PRO_PLANS.find((p) => p.id === state.profile.pro?.plan)?.name;

  if (pro) {
    return (
      <Card>
        <View className="flex-row items-center gap-2">
          <Crown color="#76b900" size={18} />
          <Text className="text-foreground font-semibold">
            SmartFit Pro{trialing ? ' Trial' : planName ? ` · ${planName}` : ''}
          </Text>
        </View>
        <Text className="text-muted-foreground mt-1 text-sm">
          {trialing
            ? `${trialDaysLeft(state)} day${trialDaysLeft(state) === 1 ? '' : 's'} left in your trial`
            : 'Adaptive targets, readiness score and full analytics are unlocked.'}
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <View className="flex-row items-center gap-2">
        <Crown color="#76b900" size={18} />
        <Text className="text-foreground font-semibold">SmartFit Pro</Text>
      </View>
      <Text className="text-muted-foreground mt-1 text-sm">
        Adaptive progression targets, a daily readiness score, quarter & year analytics and
        unlimited routines — from $4.17/mo.
      </Text>
      <Text className="text-muted-foreground mt-2 text-xs">
        Subscriptions are managed in the SmartFit web app for now; your Pro status lights up here
        automatically.
      </Text>
    </Card>
  );
}

export default function ProfileScreen() {
  const { state, updateProfile, clearData } = useStore();
  const [bodyOpen, setBodyOpen] = useState(false);
  const [name, setName] = useState(state.profile.name);

  const weight = latestBodyValue(state, 'weight');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <Text className="text-foreground text-2xl font-bold">Profile</Text>
        <Text className="text-muted-foreground text-sm">Your data stays on this device.</Text>

        <Card>
          <View className="mb-3 flex-row items-center gap-2">
            <UserRound color="#9cff00" size={18} />
            <Text className="text-foreground font-semibold">You</Text>
          </View>
          <Label>Name</Label>
          <Input
            value={name}
            onChangeText={setName}
            onBlur={() => updateProfile({ name })}
            placeholder="Your name"
          />
          <View className="mt-3">
            <Label>Strategy</Label>
            <Text className="border-border bg-background text-foreground rounded-xl border p-3 text-sm">
              {PLANS.find((p) => p.id === state.profile.planId)?.name}
            </Text>
          </View>
        </Card>

        <ProCard />

        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <Database color="#9cff00" size={18} />
            <Text className="text-foreground font-semibold">Your data</Text>
          </View>
          <Text className="text-muted-foreground text-sm">
            {state.sessions.length} workouts · {state.schedule.length} scheduled ·{' '}
            {state.goals.length} goals · {state.bodyLogs.length} measurements
          </Text>
          {weight != null && (
            <Text className="text-muted-foreground mt-1 text-sm">Latest weight: {weight} kg</Text>
          )}
          <View className="mt-4 gap-2">
            <Button label="Log measurement" variant="secondary" onPress={() => setBodyOpen(true)} />
            <Button
              label="Erase everything"
              variant="destructive"
              onPress={() =>
                Alert.alert(
                  'Erase data',
                  'Delete all SmartFit data on this device? This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Erase', style: 'destructive', onPress: clearData },
                  ],
                )
              }
            />
          </View>
        </Card>

        <View className="flex-row items-center justify-center gap-2 py-4">
          <RefreshCw color="#a3a3a3" size={14} />
          <Text className="text-muted-foreground text-xs">
            Local-first · no account · no trackers
          </Text>
        </View>
      </ScrollView>

      <BodyModal open={bodyOpen} onClose={() => setBodyOpen(false)} />
    </SafeAreaView>
  );
}
