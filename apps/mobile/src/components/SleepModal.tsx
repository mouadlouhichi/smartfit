import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { X, Moon } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { haptics } from '@/lib/haptics';
import { toISODate } from '@smartfit/core';

export function SleepModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addSleepLog } = useStore();
  const [hours, setHours] = useState('7');
  const [minutes, setMinutes] = useState('30');
  const [deep, setDeep] = useState('');
  const [rem, setRem] = useState('');
  const [light, setLight] = useState('');
  const [awake, setAwake] = useState('');
  const [quality, setQuality] = useState(3);

  useEffect(() => {
    if (!open) return;
    setHours('7');
    setMinutes('30');
    setDeep('');
    setRem('');
    setLight('');
    setAwake('');
    setQuality(3);
  }, [open]);

  const submit = () => {
    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;
    const total = Math.max(0, Math.round(h * 60 + m));
    if (total <= 0) {
      onClose();
      return;
    }
    const hasStages = [deep, rem, light, awake].some((x) => x !== '' && Number(x) > 0);
    addSleepLog({
      date: toISODate(new Date()),
      durationMin: total,
      source: 'manual',
      quality: quality as 1 | 2 | 3 | 4 | 5,
      stages: hasStages
        ? {
            deep: Math.max(0, Math.round(Number(deep) || 0)),
            rem: Math.max(0, Math.round(Number(rem) || 0)),
            light: Math.max(0, Math.round(Number(light) || 0)),
            awake: Math.max(0, Math.round(Number(awake) || 0)),
          }
        : undefined,
    });
    haptics.success();
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: '#161616',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: 'rgba(139,92,246,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Moon size={20} color="#8b5cf6" />
              </View>
              <View>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Log sleep</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  Last night’s duration & optional stages
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color="#9ca3af" />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }}>
            <Text
              style={{
                color: '#9ca3af',
                fontSize: 12,
                fontWeight: '700',
                marginBottom: 8,
                letterSpacing: 1,
              }}
            >
              DURATION
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              <Field label="Hours" value={hours} onChange={setHours} keyboardType="number-pad" />
              <Field
                label="Minutes"
                value={minutes}
                onChange={setMinutes}
                keyboardType="number-pad"
              />
            </View>

            <Text
              style={{
                color: '#9ca3af',
                fontSize: 12,
                fontWeight: '700',
                marginBottom: 8,
                letterSpacing: 1,
              }}
            >
              STAGES (OPTIONAL, MIN)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              <StageField label="Deep" color="#4f46e5" value={deep} onChange={setDeep} />
              <StageField label="REM" color="#8b5cf6" value={rem} onChange={setRem} />
              <StageField label="Light" color="#6366f1" value={light} onChange={setLight} />
              <StageField label="Awake" color="#94a3b8" value={awake} onChange={setAwake} />
            </View>

            <Text
              style={{
                color: '#9ca3af',
                fontSize: 12,
                fontWeight: '700',
                marginBottom: 8,
                letterSpacing: 1,
              }}
            >
              QUALITY
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    haptics.selection();
                    setQuality(n);
                  }}
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: n <= quality ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>
                    {n <= quality ? ['😴', '😐', '🙂', '😊', '⚡'][n - 1] : '·'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={submit}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#78b800' : '#8AD200',
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#0E0E0E', fontSize: 15, fontWeight: '800' }}>Save sleep</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType: 'default' | 'number-pad';
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          color: '#fff',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          fontWeight: '700',
        }}
      />
    </View>
  );
}

function StageField({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#6b7280"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          color: '#fff',
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 10,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: '700',
        }}
      />
    </View>
  );
}
