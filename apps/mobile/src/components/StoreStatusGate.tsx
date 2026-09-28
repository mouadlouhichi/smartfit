import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createTranslator, resolveLocale } from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui';

export function StoreStatusGate({ children }: { children: React.ReactNode }) {
  const { state, ready, loadError, retryLoad } = useStore();
  const t = useMemo(
    () => createTranslator(resolveLocale(state.profile.locale)),
    [state.profile.locale],
  );

  if (!ready) {
    return (
      <SafeAreaView
        className="bg-background flex-1"
        accessibilityLabel={t('progress.mobile.loading')}
      >
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <ActivityIndicator color="#f3ff47" size="large" />
          <Text className="text-muted-foreground text-sm">{t('progress.mobile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center gap-4 px-6">
          <View className="gap-2">
            <Text className="text-foreground text-xl font-bold">
              {t('progress.mobile.loadError.title')}
            </Text>
            <Text className="text-muted-foreground text-sm leading-6">
              {t('progress.mobile.loadError.body')}
            </Text>
          </View>
          <Button label={t('action.retry')} onPress={retryLoad} />
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
