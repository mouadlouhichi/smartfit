import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Lock, Fingerprint } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { authenticate, getBiometricAvailability } from '@/lib/biometrics';
import { haptics } from '@/lib/haptics';

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [err, setErr] = useState<string | null>(null);

  const enabled = state.profile.biometricLock && !__DEV__; // Skip gate in dev for speed

  useEffect(() => {
    if (!enabled) {
      setUnlocked(true);
      return;
    }
    getBiometricAvailability().then((res) => {
      setAvailable(res.available && res.enrolled);
      setBioLabel(res.types[0] || 'Biometrics');
      if (res.available && res.enrolled) tryAuth();
      else if (res.available && !res.enrolled) {
        setErr('No biometrics enrolled on this device.');
      }
    });
  }, [enabled]);

  const tryAuth = async () => {
    setErr(null);
    try {
      const ok = await authenticate('Unlock SmartFit to see your recovery, goals, and workouts.');
      if (ok) {
        await haptics.success();
        setUnlocked(true);
      } else {
        setErr('Authentication failed. Try again.');
        await haptics.error();
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Authentication error');
    }
  };

  if (unlocked || !enabled) return <>{children}</>;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0a0a0a',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: 'rgba(138,210,0,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <Lock size={40} color="#8AD200" />
      </View>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 }}>
        SmartFit Locked
      </Text>
      <Text
        style={{
          color: '#9ca3af',
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 20,
        }}
      >
        Your recovery, health, and training data are private. Authenticate to continue.
      </Text>

      <Pressable
        onPress={tryAuth}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#8AD200',
          paddingHorizontal: 28,
          paddingVertical: 16,
          borderRadius: 999,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Fingerprint size={20} color="#0a0a0a" />
        <Text style={{ color: '#0a0a0a', fontWeight: '900', fontSize: 16 }}>
          {available ? `Use ${bioLabel}` : 'Authenticate'}
        </Text>
      </Pressable>

      {err && <Text style={{ color: '#ef4444', marginTop: 16, fontSize: 13 }}>{err}</Text>}

      {!available && Platform.OS !== 'web' && (
        <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
          No biometrics enrolled. Set up Face ID or Touch ID in your device Settings, or turn off
          Biometric Lock in your SmartFit profile.
        </Text>
      )}
    </View>
  );
}
