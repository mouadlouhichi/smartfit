import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { X, Heart, Activity, Wind, Droplet, Thermometer, Footprints } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { haptics } from '@/lib/haptics';
import { toISODate } from '@smartfit/core';

interface VField {
  key: 'restingHR' | 'hrvRmssd' | 'respiratoryRate' | 'spo2' | 'skinTempDelta' | 'steps';
  label: string;
  unit: string;
  placeholder: string;
  icon: React.ElementType;
  color: string;
}

const FIELDS: VField[] = [
  {
    key: 'restingHR',
    label: 'Resting HR',
    unit: 'bpm',
    placeholder: '58',
    icon: Heart,
    color: '#f43f5e',
  },
  {
    key: 'hrvRmssd',
    label: 'HRV (rMSSD)',
    unit: 'ms',
    placeholder: '50',
    icon: Activity,
    color: '#8AD200',
  },
  {
    key: 'respiratoryRate',
    label: 'Resp rate',
    unit: 'br/min',
    placeholder: '15',
    icon: Wind,
    color: '#38bdf8',
  },
  {
    key: 'spo2',
    label: 'Blood oxygen',
    unit: '%',
    placeholder: '97',
    icon: Droplet,
    color: '#22c55e',
  },
  {
    key: 'skinTempDelta',
    label: 'Wrist temp Δ',
    unit: '°C',
    placeholder: '0.0',
    icon: Thermometer,
    color: '#f97316',
  },
  {
    key: 'steps',
    label: 'Steps',
    unit: '',
    placeholder: '8000',
    icon: Footprints,
    color: '#a855f7',
  },
];

export function VitalsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addVitalsLog } = useStore();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setValues({});
  }, [open]);

  const submit = () => {
    const num = (k: string) => {
      const s = values[k];
      if (s === undefined || s.trim() === '') return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };
    addVitalsLog({
      date: toISODate(new Date()),
      source: 'manual',
      restingHR: num('restingHR'),
      hrvRmssd: num('hrvRmssd'),
      respiratoryRate: num('respiratoryRate'),
      spo2: num('spo2'),
      skinTempDelta: num('skinTempDelta'),
      steps: num('steps'),
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
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: 'rgba(244,63,94,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Heart size={20} color="#f43f5e" />
              </View>
              <View>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Log vitals</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  All fields are optional — log what you have.
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color="#9ca3af" />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {FIELDS.map((f) => (
                <View key={f.key} style={{ width: '48%' }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}
                  >
                    <f.icon size={14} color={f.color} />
                    <Text style={{ color: '#d1d5db', fontSize: 11, fontWeight: '700' }}>
                      {f.label}
                    </Text>
                  </View>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      value={values[f.key] ?? ''}
                      onChangeText={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                      keyboardType="decimal-pad"
                      placeholder={f.placeholder}
                      placeholderTextColor="#6b7280"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        paddingRight: f.unit ? 48 : 14,
                        fontSize: 16,
                        fontWeight: '700',
                      }}
                    />
                    {f.unit ? (
                      <Text
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: 14,
                          color: '#6b7280',
                          fontSize: 12,
                        }}
                      >
                        {f.unit}
                      </Text>
                    ) : null}
                  </View>
                </View>
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
            <Text style={{ color: '#0E0E0E', fontSize: 15, fontWeight: '800' }}>Save vitals</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
