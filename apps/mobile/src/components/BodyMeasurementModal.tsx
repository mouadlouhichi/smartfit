import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { Button, Card, Input, Label } from './ui';
import {
  BODY_UNIT_KEYS,
  bodyDisplayUnit,
  bodyValueToCanonical,
  createTranslator,
  resolveLocale,
  toISODate,
  type BodyUnit,
} from '@smartfit/core';

const BODY_UNITS: BodyUnit[] = ['weight', 'bodyfat', 'waist'];

export function BodyMeasurementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, ready, addBodyLog } = useStore();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [unit, setUnit] = useState<BodyUnit>('weight');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setUnit('weight');
    setValue('');
  }, [open]);

  const displayUnit = bodyDisplayUnit(unit, state.profile);
  const parsedValue = Number(value.trim().replace(',', '.'));
  const canSave = ready && Number.isFinite(parsedValue) && parsedValue > 0;

  function save() {
    if (!canSave) return;
    addBodyLog({
      date: toISODate(new Date()),
      unit,
      value: bodyValueToCanonical(parsedValue, unit, state.profile),
    });
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
        <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
          <View className="pr-4">
            <Text className="text-foreground text-lg font-bold">{t('modal.body.title.new')}</Text>
            <Text className="text-muted-foreground mt-1 text-sm">{t('modal.body.blurb')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('action.close')}
            onPress={onClose}
            className="bg-secondary h-11 w-11 items-center justify-center rounded-full"
          >
            <Text className="text-foreground text-xl">×</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-5 p-5 pb-8">
          <Card>
            <Label>{t('modal.field.measurement')}</Label>
            <View className="flex-row flex-wrap gap-2">
              {BODY_UNITS.map((candidate) => {
                const selected = unit === candidate;
                return (
                  <Pressable
                    key={candidate}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setUnit(candidate)}
                    className="min-h-11 justify-center rounded-full border px-4"
                    style={{
                      borderColor: selected ? '#f3ff47' : '#3a3a3a',
                      backgroundColor: selected ? 'rgba(243,255,71,0.12)' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? '#f3ff47' : '#d1d1d1' }}
                    >
                      {t(BODY_UNIT_KEYS[candidate])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <View>
            <Label>{`${t('modal.field.value')} (${displayUnit})`}</Label>
            <Input
              accessibilityLabel={`${t(BODY_UNIT_KEYS[unit])}, ${displayUnit}`}
              keyboardType="decimal-pad"
              returnKeyType="done"
              value={value}
              onChangeText={setValue}
              placeholder={displayUnit ? `0.0 ${displayUnit}` : '0.0'}
            />
          </View>

          <Button
            accessibilityRole="button"
            label={t('modal.body.saveNew')}
            onPress={save}
            disabled={!canSave}
            className="mt-1"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
