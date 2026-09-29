import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  Crown,
  Database,
  Fingerprint,
  HeartPulse,
  LogOut,
  RefreshCw,
  Shield,
  UserRound,
} from 'lucide-react-native';
import {
  PRO_PLANS,
  hasProAccess,
  isTrialing,
  latestBodyValue,
  trialDaysLeft,
  PLANS,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/firebase/auth-context';
import { useQuickActions } from '@/components/QuickActionsProvider';
import { Button, Card, Input, Label } from '@/components/ui';

/**
 * Only rendered in cloud mode. Mirrors the account block on the web profile:
 * which account is signed in, and the one way out of it. Local-mode installs
 * have no account and therefore nothing to sign out of.
 */
function AccountCard() {
  const { mode, user, signOut, loading } = useAuth();
  if (mode !== 'cloud' || !user) return null;

  return (
    <Card>
      <View className="mb-2 flex-row items-center gap-2">
        <Shield color="#8AD200" size={18} />
        <Text className="text-foreground font-semibold">Account</Text>
      </View>
      <Text className="text-muted-foreground text-sm">{user.email ?? user.displayName}</Text>
      <Text className="text-muted-foreground mt-1 text-xs">
        Signed in — your training syncs with this account on the web app.
      </Text>
      <View className="mt-4">
        <Button
          label={loading ? 'Signing out…' : 'Sign out'}
          variant="secondary"
          icon={<LogOut color="#f3ff47" size={16} />}
          disabled={loading}
          onPress={() => {
            Alert.alert('Sign out', 'Sign out of SmartFit on this device?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
        />
      </View>
    </Card>
  );
}

function HealthConnectCard() {
  const {
    hcAvailable,
    hcStatus,
    hcMessage,
    hcLastSync,
    syncHealthConnect,
    requestHealthAccess,
    installHealthConnect,
  } = useStore();
  const [busy, setBusy] = useState(false);

  const onSync = async () => {
    setBusy(true);
    try {
      const res = await syncHealthConnect();
      if (res.status === 'permission-denied') {
        await requestHealthAccess();
      }
    } finally {
      setBusy(false);
    }
  };

  const lastSyncText = hcLastSync ? new Date(hcLastSync).toLocaleString() : 'Never';

  if (Platform.OS !== 'android') {
    return (
      <Card>
        <View className="mb-2 flex-row items-center gap-2">
          <HeartPulse color="#f97316" size={18} />
          <Text className="text-foreground font-semibold">Wearable sync</Text>
        </View>
        <Text className="text-muted-foreground text-sm">
          Health Connect is an Android feature. Apple Health sync for iOS is on the roadmap.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <View className="mb-2 flex-row items-center gap-2">
        <HeartPulse color="#f97316" size={18} />
        <Text className="text-foreground font-semibold">Health Connect</Text>
      </View>
      <Text className="text-muted-foreground text-sm">
        Sync steps, heart rate, sleep &amp; workouts from Google Health Connect (Oura, Garmin,
        Fitbit, Samsung Health, Pixel Watch…) to power your recovery score.
      </Text>
      <Text className="text-muted-foreground mt-2 text-xs">
        Status: <Text className="text-foreground">{hcStatus}</Text>
      </Text>
      {hcMessage ? <Text className="text-muted-foreground text-xs">{hcMessage}</Text> : null}
      <Text className="text-muted-foreground text-xs">Last sync: {lastSyncText}</Text>
      <View className="mt-3 gap-2">
        {!hcAvailable ? (
          <Button
            label="Install Health Connect"
            variant="secondary"
            onPress={installHealthConnect}
          />
        ) : (
          <>
            <Button label={busy ? 'Syncing…' : 'Sync now'} onPress={onSync} disabled={busy} />
            {hcStatus === 'permission-denied' && (
              <Button label="Grant permissions" variant="secondary" onPress={requestHealthAccess} />
            )}
          </>
        )}
      </View>
    </Card>
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
          <Crown color="#cbe02c" size={18} />
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
        <Crown color="#cbe02c" size={18} />
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
  const { openMeasurement } = useQuickActions();
  const [name, setName] = useState(state.profile.name);

  const weight = latestBodyValue(state, 'weight');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28 gap-4">
        <Text className="text-foreground text-2xl font-bold">Profile</Text>
        <Text className="text-muted-foreground text-sm">Your data stays on this device.</Text>

        <Card>
          <View className="mb-3 flex-row items-center gap-2">
            <UserRound color="#f3ff47" size={18} />
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

        <AccountCard />

        <ProCard />

        <HealthConnectCard />

        {Platform.OS !== 'web' && (
          <Card>
            <View className="mb-2 flex-row items-center gap-2">
              <Shield color="#8AD200" size={18} />
              <Text className="text-foreground font-semibold">Privacy &amp; security</Text>
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Fingerprint color="#a3a3a3" size={20} />
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-semibold">Biometric lock</Text>
                  <Text className="text-muted-foreground text-xs">
                    Require Face ID / Touch ID to open SmartFit. Data never leaves your device.
                  </Text>
                </View>
              </View>
              <Switch
                value={!!state.profile.biometricLock}
                onValueChange={(v) => updateProfile({ biometricLock: v })}
                trackColor={{ false: '#27272a', true: '#8AD200' }}
                thumbColor="#0a0a0a"
              />
            </View>
          </Card>
        )}

        <Card>
          <View className="mb-2 flex-row items-center gap-2">
            <Database color="#f3ff47" size={18} />
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
            <Button label="Log measurement" variant="secondary" onPress={openMeasurement} />
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
    </SafeAreaView>
  );
}
