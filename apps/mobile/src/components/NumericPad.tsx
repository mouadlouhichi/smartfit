import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Check, Delete } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

/**
 * Custom OLED numeric keypad sheet. Matches the Volt dark theme and gives
 * haptic feedback for every tap so weight/rep/sets entry feels physical.
 *
 * Usage:
 *   <NumericPad
 *     open={open}
 *     title="Weight"
 *     unit="kg"
 *     value={weight}
 *     decimals={1}
 *     max={999}
 *     onClose={() => setOpen(false)}
 *     onSubmit={(v) => setWeight(v)}
 *   />
 */
export interface NumericPadProps {
  open: boolean;
  title?: string;
  unit?: string;
  value?: number;
  decimals?: number; // 0 = integer only, 1 = one decimal place, etc.
  max?: number;
  min?: number;
  onClose: () => void;
  onSubmit: (value: number) => void;
}

const KEYS: (string | 'del' | 'ok' | 'dot')[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'dot',
  '0',
  'del',
];

export function NumericPad({
  open,
  title,
  unit,
  value,
  decimals = 0,
  max = 9999,
  min = 0,
  onClose,
  onSubmit,
}: NumericPadProps) {
  const [buffer, setBuffer] = useState<string>(value != null ? String(value) : '');

  React.useEffect(() => {
    if (open) setBuffer(value != null ? String(value) : '');
  }, [open, value]);

  if (!open) return null;

  const press = (k: string) => {
    haptics.selection().catch(() => {});
    if (k === 'del') {
      setBuffer((b) => b.slice(0, -1));
      return;
    }
    if (k === 'dot') {
      if (decimals > 0 && !buffer.includes('.')) setBuffer((b) => (b.length ? b + '.' : '0.'));
      return;
    }
    const next = buffer + k;
    if (next === '.') {
      setBuffer('0.');
      return;
    }
    const num = Number(next);
    if (Number.isFinite(num) && num <= max && next.length <= 6) {
      // enforce decimal cap
      const [, frac = ''] = next.split('.');
      if (frac.length <= decimals) setBuffer(next);
    }
  };

  const commit = () => {
    haptics.success().catch(() => {});
    const n = Number(buffer || '0');
    onSubmit(Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0)));
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#0a0a0a',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            paddingBottom: 32,
            borderTopWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Text
            style={{
              color: '#9ca3af',
              fontSize: 12,
              textAlign: 'center',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {title || 'Enter value'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 44,
                fontWeight: '900',
                minWidth: 80,
                textAlign: 'right',
              }}
            >
              {buffer || '0'}
            </Text>
            {unit ? (
              <Text style={{ color: '#9ca3af', fontSize: 18, fontWeight: '700' }}>{unit}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KEYS.map((k) => {
              if (k === 'del') {
                return (
                  <KeyBtn key="del" label="" onTap={() => press('del')} wide>
                    <Delete color="#fff" size={22} />
                  </KeyBtn>
                );
              }
              return <KeyBtn key={k} label={k === 'dot' ? '.' : k} onTap={() => press(k)} />;
            })}
            <Pressable
              onPress={commit}
              style={({ pressed }) => ({
                width: '100%',
                height: 58,
                marginTop: 4,
                borderRadius: 14,
                backgroundColor: '#8AD200',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Check size={22} color="#0a0a0a" />
              <Text style={{ color: '#0a0a0a', fontWeight: '900', fontSize: 18 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function KeyBtn({
  label,
  onTap,
  children,
  wide,
}: {
  label?: string;
  onTap: () => void;
  children?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => ({
        width: wide ? '66%' : '31%',
        flexGrow: 1,
        height: 58,
        borderRadius: 14,
        backgroundColor: pressed ? '#262626' : '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {children ?? <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{label}</Text>}
    </Pressable>
  );
}
