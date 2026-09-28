import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createTranslator,
  parseMealDescription,
  resolveLocale,
  toISODate,
  type MealScan,
  type MealSlot,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button, Card, Input, Label } from './ui';

const SLOT_LABELS: Record<
  MealSlot,
  'fuel.slot.breakfast' | 'fuel.slot.lunch' | 'fuel.slot.dinner' | 'fuel.slot.snack'
> = {
  breakfast: 'fuel.slot.breakfast',
  lunch: 'fuel.slot.lunch',
  dinner: 'fuel.slot.dinner',
  snack: 'fuel.slot.snack',
};
const SLOTS = Object.keys(SLOT_LABELS) as MealSlot[];

function suggestedSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function hasTypedMacros(text: string): boolean {
  return /\b\d{2,4}\s*(?:kcal|calories|cal)\b|\b(?:protein|carbs?|carbohydrates|fat)\s*:?\s*\d{1,3}\s*g\b|\b\d{1,3}\s*g\s+(?:of\s+)?(?:protein|carbs?|carbohydrates|fat)\b(?!\s*(?:powder|bar)\b)/i.test(
    text,
  );
}

/** Native meal logging: typed values or an editable estimate from the local food table. */
export function MealEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, ready, addMeal } = useStore();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [slot, setSlot] = useState<MealSlot>(suggestedSlot);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [estimate, setEstimate] = useState<MealScan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSlot(suggestedSlot());
    setDescription('');
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setEstimate(null);
    setError('');
  }, [open]);

  function changeDescription(value: string) {
    setDescription(value);
    // Do not leave stale estimate numbers attached to a newly edited description.
    if (estimate) {
      setEstimate(null);
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    }
    setError('');
  }

  function estimateFromText() {
    if (hasTypedMacros(description)) {
      setEstimate(null);
      setError('explicit');
      return;
    }
    const result = parseMealDescription(description, { locale });
    if (result.empty) {
      setEstimate(null);
      setError('empty');
      return;
    }
    setEstimate(result);
    setName((current) => current.trim() || result.name || description.trim());
    setCalories(String(result.calories));
    setProtein(String(result.protein));
    setCarbs(String(result.carbs));
    setFat(String(result.fat));
    setError('');
  }

  const parsedCalories = parseNumber(calories);
  const parsedProtein = parseNumber(protein);
  const parsedCarbs = parseNumber(carbs);
  const parsedFat = parseNumber(fat);
  const cleanName = name.trim() || description.trim();
  const canSave =
    ready &&
    cleanName.length > 0 &&
    calories.trim().length > 0 &&
    parsedCalories !== null &&
    (protein.trim().length === 0 || parsedProtein !== null) &&
    (carbs.trim().length === 0 || parsedCarbs !== null) &&
    (fat.trim().length === 0 || parsedFat !== null);

  function save() {
    if (!canSave) {
      setError(cleanName ? 'numbers' : 'name');
      return;
    }
    addMeal({
      date: toISODate(new Date()),
      name: cleanName,
      slot,
      calories: parsedCalories ?? 0,
      protein: parsedProtein ?? 0,
      carbs: parsedCarbs ?? undefined,
      fat: parsedFat ?? undefined,
      source: estimate ? 'scan' : 'manual',
      scanned: estimate ? true : undefined,
      items: estimate?.items.length ? estimate.items : undefined,
    });
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
        <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
          <View className="flex-1 pr-4">
            <Text className="text-foreground text-lg font-bold">{t('meal.title.log')}</Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              {t('meal.mobile.description')}
            </Text>
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

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="flex-1"
            contentContainerClassName="gap-4 p-5 pb-8"
          >
            <Card>
              <Text className="text-foreground mb-3 text-sm font-semibold">
                {t('meal.field.slot')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SLOTS.map((candidate) => {
                  const selected = slot === candidate;
                  return (
                    <Pressable
                      key={candidate}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSlot(candidate)}
                      className="min-h-10 justify-center rounded-full border px-3"
                      style={{
                        borderColor: selected ? '#f3ff47' : '#3a3a3a',
                        backgroundColor: selected ? 'rgba(243,255,71,0.1)' : 'transparent',
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: selected ? '#f3ff47' : '#d4d4d4' }}
                      >
                        {t(SLOT_LABELS[candidate])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <View>
              <Label>{t('meal.scan.input')}</Label>
              <TextInput
                accessibilityLabel={t('meal.scan.input')}
                value={description}
                onChangeText={changeDescription}
                placeholder={t('meal.scan.placeholder')}
                placeholderTextColor="#8a8a8a"
                multiline
                textAlignVertical="top"
                className="border-border bg-card text-foreground min-h-24 rounded-2xl border px-4 py-3 text-base"
              />
              <Text className="text-muted-foreground mt-2 text-xs leading-5">
                {t('meal.mobile.estimateNotice')}
              </Text>
              <Button
                label={t('meal.mobile.estimateCta')}
                variant="secondary"
                disabled={!description.trim()}
                onPress={estimateFromText}
                className="mt-3 self-start"
              />
            </View>

            {estimate ? (
              <Card className="border-primary/40">
                <Text className="text-primary text-sm font-bold">{t('meal.mobile.estimated')}</Text>
                <Text className="text-muted-foreground mt-1 text-xs leading-5">
                  {t('meal.mobile.reviewNotice')}
                </Text>
                {estimate.matched.length > 0 ? (
                  <Text className="text-foreground mt-2 text-xs leading-5">
                    {estimate.matched.join(' · ')}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            <View>
              <Label>{t('meal.field.name')}</Label>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('meal.mobile.namePlaceholder')}
                returnKeyType="done"
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Label>{t('meal.field.calories')}</Label>
                <Input
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View className="flex-1">
                <Label>{t('meal.field.protein')}</Label>
                <Input
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Label>{t('meal.field.carbs')}</Label>
                <Input
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="decimal-pad"
                  placeholder="—"
                />
              </View>
              <View className="flex-1">
                <Label>{t('meal.field.fat')}</Label>
                <Input
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="decimal-pad"
                  placeholder="—"
                />
              </View>
            </View>

            {error === 'explicit' ? (
              <Text className="text-destructive text-sm leading-5">
                {t('meal.mobile.useFields')}
              </Text>
            ) : error === 'empty' ? (
              <Text className="text-destructive text-sm">{t('meal.scan.empty')}</Text>
            ) : error === 'name' ? (
              <Text className="text-destructive text-sm">{t('meal.error.name')}</Text>
            ) : error === 'numbers' ? (
              <Text className="text-destructive text-sm">{t('meal.mobile.errorNumbers')}</Text>
            ) : null}

            <View className="flex-row gap-3 pt-1">
              <Button
                label={t('action.cancel')}
                variant="secondary"
                onPress={onClose}
                className="flex-1"
              />
              <Button
                label={t('meal.save')}
                onPress={save}
                disabled={!canSave}
                className="flex-1"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
