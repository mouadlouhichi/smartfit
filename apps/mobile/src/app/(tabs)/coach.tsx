import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Send, ShieldCheck, Sparkles } from 'lucide-react-native';
import {
  answerCoach,
  COACH_QUICK_REPLIES,
  createTranslator,
  resolveLocale,
  type CoachAnswer,
  type CoachChip,
} from '@smartfit/core';
import { useStore } from '@/lib/store';

type Message = {
  id: string;
  role: 'user' | 'coach';
  text: string;
  chips?: CoachChip[];
};

type Prompt = {
  labelKey:
    'coach.prompt.week' | 'coach.prompt.today' | 'coach.prompt.calories' | 'coach.prompt.goals';
  question: string;
};

const PROMPTS: Prompt[] = [
  { labelKey: 'coach.prompt.week', question: COACH_QUICK_REPLIES[0] },
  { labelKey: 'coach.prompt.today', question: COACH_QUICK_REPLIES[1] },
  { labelKey: 'coach.prompt.calories', question: COACH_QUICK_REPLIES[2] },
  { labelKey: 'coach.prompt.goals', question: COACH_QUICK_REPLIES[3] },
];

function answerMessage(answer: CoachAnswer): Pick<Message, 'text' | 'chips'> {
  return { text: answer.text, chips: answer.chips };
}

function CoachMetric({ chip }: { chip: CoachChip }) {
  return (
    <View className="bg-background border-border rounded-xl border px-3 py-2.5">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="text-muted-foreground flex-1 text-xs font-medium">
          {chip.label}
        </Text>
        <Text className="text-foreground text-xs font-bold">{chip.value}</Text>
      </View>
      <View className="bg-secondary h-1.5 overflow-hidden rounded-full">
        <View
          className="bg-primary h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, chip.pct))}%` }}
        />
      </View>
    </View>
  );
}

function CoachBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <View className="mb-3 items-end">
        <View className="bg-primary max-w-[88%] rounded-3xl rounded-br-md px-4 py-3">
          <Text className="text-primary-foreground text-[15px] leading-6">{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-3 max-w-[94%] self-start">
      <View className="bg-card border-border rounded-3xl rounded-bl-md border px-4 py-3.5">
        <Text className="text-foreground text-[15px] leading-6">{message.text}</Text>
        {message.chips && message.chips.length > 0 && (
          <View className="mt-3 gap-2">
            {message.chips.map((chip) => (
              <CoachMetric key={`${chip.label}-${chip.value}`} chip={chip} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function CoachScreen() {
  const router = useRouter();
  const { state, ready } = useStore();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 'greeting', role: 'coach', text: t('coach.mobile.greeting') },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [messages, thinking]);

  function send(question: string) {
    const clean = question.trim();
    if (!clean || !ready || sendingRef.current) return;

    sendingRef.current = true;
    setThinking(true);
    setDraft('');
    setMessages((previous) => [
      ...previous,
      { id: `user-${Date.now()}`, role: 'user', text: clean },
    ]);
    void Haptics.selectionAsync().catch(() => {});

    timerRef.current = setTimeout(() => {
      const reply = answerMessage(answerCoach(clean, state));
      setMessages((previous) => [
        ...previous,
        { id: `coach-${Date.now()}`, role: 'coach', ...reply },
      ]);
      setThinking(false);
      sendingRef.current = false;
      timerRef.current = null;
    }, 380);
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View className="border-border flex-row items-center gap-3 border-b px-4 py-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="bg-secondary h-10 w-10 items-center justify-center rounded-full"
          >
            <ArrowLeft color="#f3ff47" size={19} />
          </Pressable>
          <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-full">
            <Sparkles color="#f3ff47" size={18} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-base font-bold">{t('nav.coach')}</Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">
              {t('coach.mobile.subtitle')}
            </Text>
          </View>
          <View className="bg-primary/10 h-9 w-9 items-center justify-center rounded-full">
            <ShieldCheck color="#f3ff47" size={17} />
          </View>
        </View>

        <View className="bg-primary/5 flex-row items-start gap-2 px-4 py-2.5">
          <ShieldCheck color="#f3ff47" size={15} style={{ marginTop: 1 }} />
          <Text className="text-muted-foreground flex-1 text-xs leading-[18px]">
            {t('coach.mobile.local')} {t('coach.mobile.safety')}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="p-4 pb-3"
        >
          <View className="mb-2 self-start">
            <View className="bg-primary/10 mb-1.5 flex-row items-center gap-1.5 rounded-full px-2.5 py-1">
              <Sparkles color="#f3ff47" size={12} />
              <Text className="text-primary text-[11px] font-bold">SmartFit Coach</Text>
            </View>
          </View>
          {!ready && (
            <View className="bg-card border-border mb-3 self-start rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#f3ff47" />
                <Text className="text-muted-foreground text-sm">{t('coach.mobile.loading')}</Text>
              </View>
            </View>
          )}
          {messages.map((message) => (
            <CoachBubble key={message.id} message={message} />
          ))}
          {thinking && (
            <View className="bg-card border-border mb-3 self-start rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#f3ff47" />
                <Text className="text-muted-foreground text-sm">{t('coach.mobile.thinking')}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View className="border-border border-t px-4 pt-3 pb-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 pb-3"
          >
            {PROMPTS.map((prompt) => (
              <Pressable
                key={prompt.labelKey}
                accessibilityRole="button"
                onPress={() => send(prompt.question)}
                disabled={!ready || thinking}
                className="bg-secondary min-h-9 justify-center rounded-full px-3 active:opacity-75"
              >
                <Text className="text-foreground text-xs font-medium">{t(prompt.labelKey)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View className="flex-row items-end gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => send(draft)}
              placeholder={t('coach.mobile.composer')}
              placeholderTextColor="#8a8a8a"
              returnKeyType="send"
              blurOnSubmit={false}
              multiline
              editable={ready && !thinking}
              accessibilityLabel={t('coach.mobile.composer')}
              className="border-border bg-card text-foreground max-h-28 min-h-12 flex-1 rounded-2xl border px-4 py-3 text-[15px]"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('coach.send')}
              accessibilityState={{ disabled: !ready || !draft.trim() || thinking }}
              disabled={!ready || !draft.trim() || thinking}
              onPress={() => send(draft)}
              className="bg-primary h-12 w-12 items-center justify-center rounded-2xl disabled:opacity-50"
            >
              <Send color="#101010" size={19} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
