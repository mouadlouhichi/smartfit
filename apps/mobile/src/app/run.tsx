import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
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
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Footprints } from 'lucide-react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  computeRunStats,
  createTranslator,
  estimateCalories,
  formatCalories,
  fmtDuration,
  fmtPace,
  formatDistance,
  latestBodyWeightKg,
  projectRoute,
  resolveLocale,
  simplifyRoute,
  toISODate,
  toKm,
  INTENSITY_META,
  type GeoPoint,
  type Intensity,
} from '@smartfit/core';
import { useStore } from '@/lib/store';
import { Button, Card, Input, Label } from '@/components/ui';

const VOLT = '#f3ff47';
type RunPhase = 'intro' | 'active' | 'paused' | 'summary';
const INTENSITIES: Intensity[] = ['low', 'moderate', 'high'];

function parsePositive(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function RoutePreview({ points, emptyLabel }: { points: GeoPoint[]; emptyLabel: string }) {
  const projected = useMemo(() => {
    if (points.length < 2) return null;
    return projectRoute(simplifyRoute(points, 180), 220, 22);
  }, [points]);

  if (!projected) {
    return (
      <View className="bg-background h-48 items-center justify-center rounded-2xl">
        <Text className="text-muted-foreground px-8 text-center text-sm leading-6">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const polyline = projected.line.map(({ x, y }) => `${x},${y}`).join(' ');
  return (
    <View className="bg-background h-48 items-center justify-center overflow-hidden rounded-2xl">
      <Svg width="180" height="180" viewBox="0 0 220 220">
        <Polyline
          points={polyline}
          fill="none"
          stroke={VOLT}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={projected.start.x} cy={projected.start.y} r={5} fill="#ffffff" />
        <Circle cx={projected.end.x} cy={projected.end.y} r={6} fill={VOLT} />
      </Svg>
    </View>
  );
}

export default function RunScreen() {
  const router = useRouter();
  const { state, ready, addSession } = useStore();
  const locale = resolveLocale(state.profile.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const distanceUnit = state.profile.distanceUnit ?? 'km';

  const [phase, setPhase] = useState<RunPhase>('intro');
  const phaseRef = useRef<RunPhase>('intro');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const pointsRef = useRef<GeoPoint[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const [clockNow, setClockNow] = useState(Date.now());
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState('');
  const [backgroundPaused, setBackgroundPaused] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderate');

  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDuration, setManualDuration] = useState('30');
  const [manualDistance, setManualDistance] = useState('');
  const [manualIntensity, setManualIntensity] = useState<Intensity>('moderate');
  const [manualError, setManualError] = useState(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const appendPoint = useCallback((candidate: GeoPoint, force = false) => {
    if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) return;
    if (candidate.lat < -90 || candidate.lat > 90 || candidate.lng < -180 || candidate.lng > 180)
      return;
    const previous = pointsRef.current[pointsRef.current.length - 1];
    const next: GeoPoint = { ...candidate, t: candidate.t ?? Date.now() };
    if (previous?.t !== undefined && next.t !== undefined && next.t <= previous.t) return;

    // Ignore implausible GPS jumps while keeping pause/resume anchors exact.
    if (!force && previous?.t !== undefined && next.t !== undefined) {
      const elapsedSec = (next.t - previous.t) / 1000;
      const dLat = ((next.lat - previous.lat) * Math.PI) / 180;
      const dLng = ((next.lng - previous.lng) * Math.PI) / 180;
      const rawA =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((previous.lat * Math.PI) / 180) *
          Math.cos((next.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const a = Math.min(1, Math.max(0, rawA));
      const meters = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (elapsedSec > 0 && meters / elapsedSec > 12) return;
    }

    const updated = [...pointsRef.current, next];
    pointsRef.current = updated;
    setPoints(updated);
  }, []);

  const stopWatching = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const attachWatcher = useCallback(async () => {
    stopWatching();
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 4,
      },
      (location) => {
        if (phaseRef.current !== 'active') return;
        const accuracy = location.coords.accuracy;
        if (accuracy != null && accuracy > 60) return;
        appendPoint({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          t: location.timestamp || Date.now(),
          ...(location.coords.altitude != null ? { ele: location.coords.altitude } : {}),
        });
      },
    );
    subscriptionRef.current = subscription;
  }, [appendPoint, stopWatching]);

  const resetRun = useCallback(() => {
    pointsRef.current = [];
    setPoints([]);
    pausedAtRef.current = null;
    pausedMsRef.current = 0;
    setBackgroundPaused(false);
    setTitle('');
    setIntensity('moderate');
    setError('');
  }, []);

  const startGpsRun = useCallback(async () => {
    if (!ready || gpsBusy) return;
    setGpsBusy(true);
    setError('');
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('services');
        return;
      }

      // The screen above this button explains foreground-only use before this request.
      const current = await Location.getForegroundPermissionsAsync();
      const permission = current.granted
        ? current
        : await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('permission');
        return;
      }

      resetRun();
      const now = Date.now();
      startedAtRef.current = now;
      setClockNow(now);
      phaseRef.current = 'active';
      setPhase('active');
      await attachWatcher();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      stopWatching();
      startedAtRef.current = null;
      phaseRef.current = 'intro';
      setPhase('intro');
      setError('unavailable');
    } finally {
      setGpsBusy(false);
    }
  }, [attachWatcher, gpsBusy, ready, resetRun, stopWatching]);

  const pauseRun = useCallback(
    (becauseBackground = false) => {
      if (phaseRef.current !== 'active') return;
      const now = Date.now();
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last) appendPoint({ ...last, t: Math.max(now, (last.t ?? now) + 1) }, true);
      pausedAtRef.current = now;
      stopWatching();
      setBackgroundPaused(becauseBackground);
      phaseRef.current = 'paused';
      setPhase('paused');
      void Haptics.selectionAsync().catch(() => {});
    },
    [appendPoint, stopWatching],
  );

  const resumeRun = useCallback(async () => {
    if (phaseRef.current !== 'paused') return;
    setError('');
    const now = Date.now();
    if (pausedAtRef.current != null) {
      pausedMsRef.current += Math.max(0, now - pausedAtRef.current);
      pausedAtRef.current = null;
    }
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (last) appendPoint({ ...last, t: Math.max(now, (last.t ?? now) + 1) }, true);
    setClockNow(now);
    phaseRef.current = 'active';
    setPhase('active');
    setBackgroundPaused(false);
    try {
      await attachWatcher();
      void Haptics.selectionAsync().catch(() => {});
    } catch {
      stopWatching();
      pausedAtRef.current = Date.now();
      phaseRef.current = 'paused';
      setPhase('paused');
      setError('unavailable');
    }
  }, [appendPoint, attachWatcher, stopWatching]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && phaseRef.current === 'active') pauseRun(true);
    });
    return () => subscription.remove();
  }, [pauseRun]);

  useEffect(() => {
    if (phase !== 'active' && phase !== 'paused') return;
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (phase === 'intro') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setDiscardOpen(true);
      return true;
    });
    return () => back.remove();
  }, [phase]);

  const stats = useMemo(() => computeRunStats(points), [points]);
  const activeElapsedSec = useMemo(() => {
    const startedAt = startedAtRef.current;
    if (startedAt == null) return 0;
    const currentPause =
      phase === 'paused' && pausedAtRef.current != null ? clockNow - pausedAtRef.current : 0;
    return Math.max(
      0,
      Math.floor((clockNow - startedAt - pausedMsRef.current - currentPause) / 1000),
    );
  }, [clockNow, phase]);
  const displayPace =
    distanceUnit === 'mi' ? stats.avgPaceMinPerKm * 1.609344 : stats.avgPaceMinPerKm;
  const estimatedCalories = estimateCalories(
    Math.max(1, Math.round(activeElapsedSec / 60)),
    intensity,
    latestBodyWeightKg(state) ?? undefined,
  );

  const finishRun = useCallback(() => {
    if (phaseRef.current === 'active') {
      const now = Date.now();
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last) appendPoint({ ...last, t: Math.max(now, (last.t ?? now) + 1) }, true);
    } else if (phaseRef.current === 'paused' && pausedAtRef.current != null) {
      pausedMsRef.current += Math.max(0, Date.now() - pausedAtRef.current);
      pausedAtRef.current = null;
    }
    stopWatching();
    setClockNow(Date.now());
    phaseRef.current = 'summary';
    setPhase('summary');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [appendPoint, stopWatching]);

  const saveTrackedRun = useCallback(() => {
    if (!ready || pointsRef.current.length < 2) return;
    const runStats = computeRunStats(pointsRef.current);
    if (runStats.distanceKm <= 0) return;
    const elapsed = Math.max(1, activeElapsedSec);
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    addSession({
      date: toISODate(new Date()),
      categoryId: 'cat-cardio',
      title: title.trim() || t('run.titleFallback'),
      durationMin,
      intensity,
      calories: estimateCalories(durationMin, intensity, latestBodyWeightKg(state) ?? undefined),
      distanceKm: runStats.distanceKm,
      exercises: [],
      route: simplifyRoute(pointsRef.current, 1000),
      movingTimeMin: Math.round(runStats.movingSec / 60),
      elevationGainM: runStats.elevationGainM,
      splits: runStats.splits,
    });
    stopWatching();
    router.back();
  }, [activeElapsedSec, addSession, intensity, ready, router, state, stopWatching, t, title]);

  const openManualLog = useCallback(() => {
    setManualTitle('');
    setManualDuration('30');
    setManualDistance('');
    setManualIntensity('moderate');
    setManualError(false);
    setManualOpen(true);
  }, []);

  const saveManualRun = useCallback(() => {
    const duration = parsePositive(manualDuration);
    const distance = manualDistance.trim() ? parsePositive(manualDistance) : null;
    if (!ready || duration == null || (manualDistance.trim() && distance == null)) {
      setManualError(true);
      return;
    }
    const durationMin = Math.max(1, Math.round(duration));
    addSession({
      date: toISODate(new Date()),
      categoryId: 'cat-cardio',
      title: manualTitle.trim() || t('run.titleFallback'),
      durationMin,
      intensity: manualIntensity,
      calories: estimateCalories(
        durationMin,
        manualIntensity,
        latestBodyWeightKg(state) ?? undefined,
      ),
      distanceKm: distance == null ? undefined : toKm(distance, distanceUnit),
      exercises: [],
      notes: t('run.mobile.manualNote'),
    });
    setManualOpen(false);
    router.back();
  }, [
    addSession,
    distanceUnit,
    manualDistance,
    manualDuration,
    manualIntensity,
    manualTitle,
    ready,
    router,
    state,
    t,
  ]);

  function requestBack() {
    if (phase === 'active' || phase === 'paused' || phase === 'summary') {
      setDiscardOpen(true);
    } else {
      router.back();
    }
  }

  function discardRun() {
    stopWatching();
    pointsRef.current = [];
    setPoints([]);
    startedAtRef.current = null;
    pausedAtRef.current = null;
    pausedMsRef.current = 0;
    setDiscardOpen(false);
    phaseRef.current = 'intro';
    setPhase('intro');
    router.back();
  }

  const errorText =
    error === 'services'
      ? t('run.mobile.servicesOff')
      : error === 'permission'
        ? t('run.mobile.permissionDenied')
        : error === 'unavailable'
          ? t('run.mobile.locationUnavailable')
          : '';

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('run.mobile.back')}
          onPress={requestBack}
          className="bg-secondary h-10 w-10 items-center justify-center rounded-full"
        >
          <ArrowLeft color="#f5f5f5" size={19} />
        </Pressable>
        <View className="items-center">
          <Text className="text-foreground text-base font-extrabold">{t('run.heading')}</Text>
          <Text className="text-muted-foreground text-[11px]">
            {phase === 'active'
              ? t('run.pause')
              : phase === 'paused'
                ? t('run.resume')
                : t('run.eyebrow')}
          </Text>
        </View>
        <View className="h-10 w-10" />
      </View>

      {phase === 'intro' ? (
        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-8">
          <View className="bg-primary/10 h-16 w-16 items-center justify-center rounded-3xl">
            <Footprints color={VOLT} size={27} strokeWidth={2.4} />
          </View>
          <View>
            <Text className="text-foreground text-3xl font-extrabold">{t('run.heading')}</Text>
            <Text className="text-muted-foreground mt-2 text-sm leading-6">
              {t('run.mobile.intro')}
            </Text>
          </View>
          <Card className="border-primary/30">
            <Text className="text-foreground text-sm font-bold">
              {t('run.mobile.locationTitle')}
            </Text>
            <Text className="text-muted-foreground mt-2 text-sm leading-6">
              {t('run.mobile.locationDisclosure')}
            </Text>
          </Card>
          {errorText ? (
            <Card className="border-destructive/40">
              <Text className="text-destructive text-sm leading-5">{errorText}</Text>
            </Card>
          ) : null}
          <Button
            label={gpsBusy ? t('run.mobile.requesting') : t('run.mobile.startGps')}
            loading={gpsBusy}
            disabled={!ready || gpsBusy}
            onPress={startGpsRun}
            className="mt-1"
          />
          <Button label={t('run.mobile.manual')} variant="secondary" onPress={openManualLog} />
        </ScrollView>
      ) : null}

      {phase === 'active' || phase === 'paused' ? (
        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-8">
          {backgroundPaused ? (
            <Card className="border-primary/40">
              <Text className="text-primary text-sm font-semibold">
                {t('run.mobile.backgroundPaused')}
              </Text>
            </Card>
          ) : null}
          {errorText ? (
            <Card className="border-destructive/40">
              <Text className="text-destructive text-sm leading-5">{errorText}</Text>
            </Card>
          ) : null}

          <Card className="items-center py-6">
            <Text className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {phase === 'paused' ? t('run.mobile.paused') : t('run.mobile.elapsed')}
            </Text>
            <Text className="text-foreground mt-2 text-6xl font-extrabold tabular-nums">
              {fmtDuration(activeElapsedSec)}
            </Text>
            <Text className="text-muted-foreground mt-2 text-xs">
              {points.length < 2 ? t('run.gps.searching') : t('run.mobile.gpsActive')}
            </Text>
          </Card>

          <View className="flex-row gap-3">
            <Card className="flex-1 items-center p-3">
              <Text className="text-muted-foreground text-xs">{t('run.stat.distance')}</Text>
              <Text className="text-foreground mt-1 text-xl font-extrabold">
                {formatDistance(stats.distanceKm, distanceUnit)}
              </Text>
            </Card>
            <Card className="flex-1 items-center p-3">
              <Text className="text-muted-foreground text-xs">{t('run.stat.avgPace')}</Text>
              <Text className="text-foreground mt-1 text-xl font-extrabold">
                {fmtPace(displayPace)} /{distanceUnit}
              </Text>
            </Card>
          </View>

          <Card>
            <Text className="text-foreground mb-3 text-sm font-bold">{t('run.route')}</Text>
            <RoutePreview points={points} emptyLabel={t('run.mobile.noRoute')} />
            <Text className="text-muted-foreground mt-2 text-xs leading-5">
              {t('run.mobile.routeLocal')}
            </Text>
          </Card>

          <View className="flex-row gap-3">
            {phase === 'active' ? (
              <Button
                label={t('run.pause')}
                variant="secondary"
                onPress={() => pauseRun(false)}
                className="flex-1"
              />
            ) : (
              <Button label={t('run.resume')} onPress={resumeRun} className="flex-1" />
            )}
            <Button label={t('run.finish')} onPress={finishRun} className="flex-1" />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDiscardOpen(true)}
            className="min-h-11 items-center justify-center"
          >
            <Text className="text-destructive text-sm font-semibold">{t('run.discard')}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {phase === 'summary' ? (
        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-8">
          <View>
            <Text className="text-primary text-xs font-bold tracking-widest uppercase">
              {t('run.complete')}
            </Text>
            <Text className="text-foreground mt-2 text-3xl font-extrabold">{t('run.heading')}</Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <Card className="min-w-[45%] flex-1 items-center">
              <Text className="text-muted-foreground text-xs">{t('run.stat.distance')}</Text>
              <Text className="text-foreground mt-2 text-2xl font-extrabold">
                {formatDistance(stats.distanceKm, distanceUnit)}
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1 items-center">
              <Text className="text-muted-foreground text-xs">{t('run.stat.time')}</Text>
              <Text className="text-foreground mt-2 text-2xl font-extrabold">
                {fmtDuration(activeElapsedSec)}
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1 items-center">
              <Text className="text-muted-foreground text-xs">{t('run.stat.avgPace')}</Text>
              <Text className="text-foreground mt-2 text-2xl font-extrabold">
                {fmtPace(displayPace)} /{distanceUnit}
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1 items-center">
              <Text className="text-muted-foreground text-xs">{t('run.stat.elevation')}</Text>
              <Text className="text-foreground mt-2 text-2xl font-extrabold">
                {Math.round(stats.elevationGainM)} m
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1 items-center">
              <Text className="text-muted-foreground text-xs">{t('run.stat.calories')}</Text>
              <Text className="text-foreground mt-2 text-2xl font-extrabold">
                {formatCalories(estimatedCalories)}
              </Text>
            </Card>
          </View>
          <Card>
            <Text className="text-foreground mb-3 text-sm font-bold">{t('run.route')}</Text>
            <RoutePreview points={points} emptyLabel={t('run.mobile.noRoute')} />
            <Text className="text-muted-foreground mt-2 text-xs leading-5">
              {t('run.mobile.routeLocal')}
            </Text>
          </Card>
          {stats.splits.length > 0 ? (
            <Card>
              <Text className="text-foreground mb-3 text-sm font-bold">{t('run.splits')}</Text>
              {stats.splits.map((split) => (
                <View
                  key={split.index}
                  className="border-border flex-row items-center justify-between border-t py-2.5"
                >
                  <Text className="text-muted-foreground text-sm">
                    {split.partial
                      ? `${(split.distanceKm * 1000).toFixed(0)} m`
                      : `${t('run.split.index', { index: split.index })} · 1 km`}
                  </Text>
                  <Text className="text-foreground text-sm font-semibold">
                    {fmtPace(split.paceMinPerKm)} /km
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
          <View>
            <Label>{t('run.field.title')}</Label>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={t('run.field.titlePlaceholder')}
            />
          </View>
          <View>
            <Label>{t('run.field.effort')}</Label>
            <View className="flex-row gap-2">
              {INTENSITIES.map((candidate) => {
                const selected = intensity === candidate;
                return (
                  <Pressable
                    key={candidate}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setIntensity(candidate)}
                    className="min-h-10 flex-1 items-center justify-center rounded-full border px-2"
                    style={{
                      borderColor: selected ? INTENSITY_META[candidate].color : '#353535',
                      backgroundColor: selected
                        ? `${INTENSITY_META[candidate].color}1a`
                        : 'transparent',
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: selected ? INTENSITY_META[candidate].color : '#b3b3b3' }}
                    >
                      {t(
                        candidate === 'low'
                          ? 'runner.intensity.easy'
                          : candidate === 'moderate'
                            ? 'runner.intensity.steady'
                            : 'runner.intensity.hard',
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Card className="border-primary/30">
            <Text className="text-muted-foreground text-sm leading-6">
              {t('run.mobile.saveNotice')}
            </Text>
          </Card>
          {stats.distanceKm > 0 ? (
            <Button label={t('run.save')} onPress={saveTrackedRun} />
          ) : (
            <Button label={t('run.mobile.manual')} variant="secondary" onPress={openManualLog} />
          )}
          <Button label={t('run.discard')} variant="ghost" onPress={() => setDiscardOpen(true)} />
        </ScrollView>
      ) : null}

      <Modal
        visible={discardOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/70 p-6">
          <Card className="w-full gap-3 p-5">
            <Text className="text-foreground text-lg font-bold">{t('run.discard.title')}</Text>
            <Text className="text-muted-foreground text-sm leading-6">{t('run.discard.body')}</Text>
            <Button
              label={t('action.cancel')}
              variant="secondary"
              onPress={() => setDiscardOpen(false)}
            />
            <Button label={t('run.discard.confirm')} variant="destructive" onPress={discardRun} />
          </Card>
        </View>
      </Modal>

      <Modal visible={manualOpen} animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
          <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-foreground text-lg font-bold">
                {t('run.mobile.manualTitle')}
              </Text>
              <Text className="text-muted-foreground mt-1 text-xs">
                {t('run.mobile.manualNotice')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('action.close')}
              onPress={() => setManualOpen(false)}
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
              <View>
                <Label>{t('run.field.title')}</Label>
                <Input
                  value={manualTitle}
                  onChangeText={setManualTitle}
                  placeholder={t('run.field.titlePlaceholder')}
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Label>{t('run.mobile.durationMin')}</Label>
                  <Input
                    value={manualDuration}
                    onChangeText={setManualDuration}
                    keyboardType="decimal-pad"
                    placeholder="30"
                  />
                </View>
                <View className="flex-1">
                  <Label>{`${t('run.stat.distance')} (${distanceUnit})`}</Label>
                  <Input
                    value={manualDistance}
                    onChangeText={setManualDistance}
                    keyboardType="decimal-pad"
                    placeholder={t('run.mobile.distanceOptional')}
                  />
                </View>
              </View>
              <View>
                <Label>{t('run.field.effort')}</Label>
                <View className="flex-row gap-2">
                  {INTENSITIES.map((candidate) => {
                    const selected = manualIntensity === candidate;
                    return (
                      <Pressable
                        key={candidate}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setManualIntensity(candidate)}
                        className="min-h-10 flex-1 items-center justify-center rounded-full border px-2"
                        style={{
                          borderColor: selected ? INTENSITY_META[candidate].color : '#353535',
                          backgroundColor: selected
                            ? `${INTENSITY_META[candidate].color}1a`
                            : 'transparent',
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: selected ? INTENSITY_META[candidate].color : '#b3b3b3' }}
                        >
                          {t(
                            candidate === 'low'
                              ? 'runner.intensity.easy'
                              : candidate === 'moderate'
                                ? 'runner.intensity.steady'
                                : 'runner.intensity.hard',
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {manualError ? (
                <Text className="text-destructive text-sm">{t('run.mobile.manualError')}</Text>
              ) : null}
              <Card className="border-primary/30">
                <Text className="text-muted-foreground text-sm leading-6">
                  {t('run.mobile.manualNotice')}
                </Text>
              </Card>
              <View className="flex-row gap-3">
                <Button
                  label={t('action.cancel')}
                  variant="secondary"
                  onPress={() => setManualOpen(false)}
                  className="flex-1"
                />
                <Button label={t('action.save')} onPress={saveManualRun} className="flex-1" />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
