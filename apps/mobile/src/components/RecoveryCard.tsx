import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Activity, Heart, Moon, Flame, Plus, AlertTriangle, TrendingUp } from 'lucide-react-native';
import { TriRing } from './RecoveryRing';
import { Card } from './ui';
import { useStore } from '@/lib/store';
import { haptics } from '@/lib/haptics';
import {
  dailyReadiness,
  dailyStrain,
  sleepOn,
  vitalsOn,
  toISODate,
  sleepScore as computeSleepScore,
} from '@smartfit/core';
import { useQuickActions } from './QuickActionsProvider';

const LABEL_COLOR: Record<string, string> = {
  Optimal: '#34d399',
  Good: '#8AD200',
  Moderate: '#fbbf24',
  Low: '#fb7185',
  Calibrating: '#9ca3af',
};

export function RecoveryCard() {
  const { state } = useStore();
  const { openVitals } = useQuickActions();
  const today = toISODate(new Date());

  const ready = useMemo(() => dailyReadiness(state, today), [state, today]);
  const strain = useMemo(() => dailyStrain(state, today), [state, today]);
  const sleep = sleepOn(state, today);
  const vitals = vitalsOn(state, today);

  const sleepPct = Math.min(100, computeSleepScore(sleep));
  const recPct = ready.score;
  const strainPct = Math.round((strain.score / 21) * 100);

  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(138,210,0,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={18} color="#8AD200" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              Recovery{' '}
              <Text style={{ color: LABEL_COLOR[ready.label] ?? '#9ca3af' }}>· {ready.label}</Text>
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
              {ready.recommendation}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            openVitals();
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
          })}
        >
          <Plus size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Log</Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <TriRing
          size={200}
          rings={[
            {
              r: 85,
              pct: sleepPct,
              color: '#8b5cf6',
              width: 9,
              trackColor: 'rgba(139,92,246,0.15)',
            },
            { r: 70, pct: recPct, color: '#8AD200', width: 10, trackColor: 'rgba(138,210,0,0.15)' },
            {
              r: 54,
              pct: strainPct,
              color: '#f97316',
              width: 9,
              trackColor: 'rgba(249,115,22,0.15)',
            },
          ]}
          centerLabel="Readiness"
          centerValue={recPct}
          centerSub="/ 100"
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Legend icon={Moon} label="Sleep" value={`${sleepPct}%`} color="#8b5cf6" />
        <Legend icon={Heart} label="Recovery" value={`${recPct}`} color="#8AD200" />
        <Legend
          icon={Flame}
          label="Strain"
          value={`${strain.score.toFixed(1)}/21`}
          color="#f97316"
        />
      </View>

      {/* Strain target bar */}
      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>Strain target today</Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {ready.recommendedStrainMin}–{ready.recommendedStrainMax}
          </Text>
        </View>
        <View
          style={{
            height: 10,
            borderRadius: 6,
            backgroundColor: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(ready.recommendedStrainMin / 21) * 100}%`,
              width: `${((ready.recommendedStrainMax - ready.recommendedStrainMin) / 21) * 100}%`,
              backgroundColor: '#8AD200',
              borderRadius: 6,
              opacity: 0.8,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              width: 3,
              borderRadius: 2,
              backgroundColor: '#fff',
              left: `${Math.min(100, (strain.score / 21) * 100)}%`,
            }}
          />
        </View>
      </View>

      {/* Factors */}
      {ready.factors.length > 0 && (
        <View style={{ marginTop: 14, gap: 6 }}>
          {ready.factors.slice(0, 3).map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              {ready.label === 'Low' && i === 0 ? (
                <AlertTriangle size={14} color="#fb7185" style={{ marginTop: 2 }} />
              ) : (
                <TrendingUp size={14} color="#8AD200" style={{ marginTop: 2 }} />
              )}
              <Text style={{ color: '#d1d5db', fontSize: 12, flex: 1, lineHeight: 18 }}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {vitals || sleep ? (
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
          <VitalMini
            label="RHR"
            value={vitals?.restingHR ? `${Math.round(vitals.restingHR)}` : '—'}
            unit="bpm"
          />
          <VitalMini
            label="HRV"
            value={vitals?.hrvRmssd ? `${Math.round(vitals.hrvRmssd)}` : '—'}
            unit="ms"
          />
          <VitalMini
            label="Resp"
            value={vitals?.respiratoryRate ? `${vitals.respiratoryRate.toFixed(1)}` : '—'}
            unit="br"
          />
          <VitalMini
            label="SpO₂"
            value={vitals?.spo2 ? `${Math.round(vitals.spo2)}` : '—'}
            unit="%"
          />
        </View>
      ) : (
        <View
          style={{
            marginTop: 14,
            padding: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(255,255,255,0.15)',
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>
            Connect Health Connect or log sleep/vitals to see your recovery score.
          </Text>
        </View>
      )}
    </Card>
  );
}

function Legend({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Icon size={16} color={color} />
      <Text style={{ color, fontWeight: '800', fontSize: 15 }}>{value}</Text>
      <Text style={{ color: '#9ca3af', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function VitalMini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#9ca3af', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{value}</Text>
      <Text style={{ color: '#9ca3af', fontSize: 9 }}>{unit}</Text>
    </View>
  );
}
