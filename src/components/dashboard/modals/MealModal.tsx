'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Camera, Crown, Loader2, Mic, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals, usePayload } from '../modal-context';
import { useConfirm } from '../confirm-context';
import {
  MEAL_SLOTS,
  foodById,
  foodLabel,
  hasProAccess,
  parseMealDescription,
  scanFromLines,
  swapAlternatives,
  swapScanLine,
  sumMeals,
  mealsOn,
  nutritionTargets,
  toISODate,
  type MealScan,
  type MealSlot,
  type MealSource,
} from '@smartfit/core';
import {
  MealScanError,
  photoScanMessage,
  resolveMealScanAvailability,
  scanMealPhoto,
  shrinkForUpload,
} from '@/lib/photo-scan';
import { speechRecognitionSupported, startVoiceInput, type VoiceSession } from '@/lib/voice-input';

/**
 * Log / edit one meal — by photo, by voice, or by typing.
 *
 * All three paths end in the *same* place: fields the athlete can see and
 * correct before saving. That is the whole design: capture is fast, but the
 * numbers are never a black box and never written behind anyone's back.
 *
 *  - **Photo** (Pro): `POST /api/meal-scan` identifies foods and portions; the
 *    macros come back computed from our own food table. Falls back to typing
 *    with a specific reason when there is no provider configured, no network,
 *    or a text-only model.
 *  - **Voice** (free): the Web Speech API writes into the text box, and the
 *    existing on-device parser handles the rest. Works offline and in French.
 *  - **Typing** (free, always): the deterministic scan, unchanged.
 */
export function MealModal() {
  const { state, addMeal, updateMeal, deleteMeal } = useStore();
  const { t, locale } = useI18n();
  const { closeModal, openWith } = useModals();
  const confirmDialog = useConfirm();
  const payload = usePayload('meal');
  const open = payload !== null;
  const editing = payload?.meal ?? null;
  const pro = hasProAccess(state);

  const [date, setDate] = useState(toISODate(new Date()));
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [scanText, setScanText] = useState('');
  /**
   * The scan currently on screen: its lines ARE the macro fields. Editing a
   * field clears it (the athlete has taken over), and a swap rewrites one line
   * and re-adds — so the chips and the numbers can never disagree.
   */
  const [scan, setScan] = useState<MealScan | null>(null);
  const [source, setSource] = useState<MealSource>('manual');
  /** Food ids behind a suggestion prefill, so its chips are swappable too. */
  const [itemsPrefill, setItemsPrefill] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoAvailable, setPhotoAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const scanAbort = useRef<AbortController | null>(null);

  const voiceSupported = useMemo(() => speechRecognitionSupported(), []);

  useEffect(() => {
    if (!open) return;
    setDate(editing?.date ?? payload?.date ?? toISODate(new Date()));
    setSlot(editing?.slot ?? payload?.slot ?? defaultSlotForNow());
    setName(editing?.name ?? '');
    setCalories(editing ? String(editing.calories) : '');
    setProtein(editing ? String(editing.protein) : '');
    setCarbs(editing?.carbs != null ? String(editing.carbs) : '');
    setFat(editing?.fat != null ? String(editing.fat) : '');
    setScanned(!!editing?.scanned);
    setScan(null);
    setSource('manual');
    // A suggestion from the fuel screen arrives as plain numbers to review.
    if (!editing && payload?.prefill) {
      setName(payload.prefill.name);
      setCalories(String(payload.prefill.calories));
      setProtein(String(payload.prefill.protein));
      setCarbs(String(payload.prefill.carbs));
      setFat(String(payload.prefill.fat));
    }
    setPhoto(null);
    setScanText('');
    setItemsPrefill(payload?.prefill?.items ?? []);
    setScanHint(null);
    setVoiceNote(null);
    setHeard(null);
    setError(null);
    setPhotoBusy(false);
  }, [open, editing, payload]);

  // Probe once per session whether the photo path exists on this deployment.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void resolveMealScanAvailability().then((info) => {
      if (alive) setPhotoAvailable(info.available);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // Stop listening and abort an in-flight scan when the dialog closes.
  useEffect(() => {
    if (open) return;
    voiceRef.current?.abort();
    voiceRef.current = null;
    setListening(false);
    scanAbort.current?.abort();
    scanAbort.current = null;
  }, [open]);

  /** Guess the slot from the clock so the common case is zero taps. */
  function defaultSlotForNow(): MealSlot {
    const h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
  }

  /** Apply a text scan (typed or dictated) to the fields. */
  function applyText(text: string, fromVoice = false) {
    const scan = parseMealDescription(text, { locale });
    if (scan.empty) {
      setScanHint(t('meal.scan.empty'));
      return;
    }
    setScanHint(null);
    setScan(scan);
    applyFields(scan);
    setScanned(true);
    setSource(fromVoice ? 'voice' : 'scan');
  }

  /** Push a scan's numbers into the editable fields. */
  function applyFields(next: MealScan) {
    if (!name.trim()) setName(next.name);
    setCalories(String(next.calories));
    setProtein(String(next.protein));
    setCarbs(String(next.carbs));
    setFat(String(next.fat));
  }

  function runScan() {
    if (!pro) {
      closeModal();
      openWith({ kind: 'pro' });
      return;
    }
    const text = scanText.trim();
    if (!text) {
      setScanHint(t('meal.scan.describe'));
      return;
    }
    applyText(text);
  }

  async function onPhotoPicked(file: File | undefined) {
    if (!file) return;
    setScanHint(null);
    setError(null);

    // Show the (downscaled) photo immediately — the athlete should see what is
    // being sent, and a spinner over their own plate is more reassuring than a
    // bare "scanning…" line.
    let preview: string | null = null;
    try {
      preview = await shrinkForUpload(file);
      setPhoto(preview);
    } catch {
      setPhoto(null);
    }

    if (!photoAvailable) {
      setPhoto(null);
      setScanHint(photoScanMessage(new MealScanError('', 'not-configured'), t));
      return;
    }

    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    setPhotoBusy(true);
    try {
      const result = await scanMealPhoto(file, { locale, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.empty) {
        setScanHint(photoScanMessage(new MealScanError('', 'provider'), t));
        return;
      }
      const resultScan = result.scan;
      setScan(resultScan);
      setScanned(true);
      setSource('photo');
      setName(resultScan.name);
      setCalories(String(resultScan.calories));
      setProtein(String(resultScan.protein));
      setCarbs(String(resultScan.carbs));
      setFat(String(resultScan.fat));
      setScanHint(t('meal.photo.result', { count: resultScan.items.length }));
    } catch (e) {
      if (controller.signal.aborted) return;
      setScanHint(photoScanMessage(e, t));
    } finally {
      if (!controller.signal.aborted) setPhotoBusy(false);
    }
  }

  function toggleVoice() {
    setVoiceNote(null);
    if (listening) {
      voiceRef.current?.stop();
      return;
    }
    if (!pro) {
      closeModal();
      openWith({ kind: 'pro' });
      return;
    }
    const session = startVoiceInput({
      locale,
      onTranscript: (text, final) => {
        setScanText(text);
        setHeard(text);
        // Parse as soon as a phrase is final, so the numbers fill themselves in
        // while the athlete is still talking.
        if (final) applyText(text, true);
      },
      onError: (message) => setVoiceNote(message),
      onEnd: () => {
        setListening(false);
        voiceRef.current = null;
      },
    });
    if (session) {
      voiceRef.current = session;
      setListening(true);
    } else {
      setVoiceNote(t('meal.voice.unsupported'));
    }
  }

  /**
   * Swap one recognised food for an alternative, at the portion that keeps the
   * energy the same. The maths runs in @smartfit/core, so the numbers shown
   * here and the numbers the fuel screen recomputes are the same numbers.
   */
  function swapLine(index: number) {
    if (!scan) return;
    const line = scan.lines[index];
    const alternatives = swapAlternatives(line.id, state, { limit: 4 });
    const next = alternatives[0];
    if (!next) return;
    const swapped = swapScanLine(scan, index, next.food.id);
    setScan(swapped);
    applyFields(swapped);
    setSource((prev) => (prev === 'photo' ? 'photo' : 'scan'));
    setScanHint(`${t('fuel.swap.applied')} → ${foodLabel(next.food.id, locale)}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const kcal = Number(calories);
    if (!name.trim()) {
      setError(t('meal.error.name'));
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setError(t('meal.error.calories'));
      return;
    }
    const prot = Number(protein);
    const record = {
      date,
      slot,
      name: name.trim().slice(0, 80),
      calories: Math.round(kcal),
      protein: Number.isFinite(prot) && prot > 0 ? Math.round(prot) : 0,
      carbs: carbs.trim() ? Math.max(0, Math.round(Number(carbs) || 0)) : undefined,
      fat: fat.trim() ? Math.max(0, Math.round(Number(fat) || 0)) : undefined,
      scanned: scanned || undefined,
      source: source === 'manual' && !scanned ? undefined : source,
      items: scan?.items.length
        ? scan.items.slice(0, 12)
        : itemsPrefill.length > 0
          ? itemsPrefill.slice(0, 12)
          : undefined,
      photo: photo && photo.length <= 120_000 ? photo : undefined,
    };
    if (editing) updateMeal(editing.id, record);
    else addMeal(record);
    closeModal();
  }

  async function remove() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: 'Delete this meal?',
      body: `“${editing.name}” from ${editing.date} will be removed from your fuel log. This cannot be undone.`,
      confirmLabel: 'Delete meal',
      destructive: true,
    });
    if (!ok) return;
    deleteMeal(editing.id);
    closeModal();
  }

  // What is left of the day, so the athlete can see the meal landing in it.
  const targets = nutritionTargets(state);
  const soFar = sumMeals(mealsOn(state.meals, date).filter((m) => m.id !== editing?.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="flex items-start gap-3 pr-8">
              <span
                aria-hidden
                className="bg-volt-soft/25 text-volt-ink flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              >
                <UtensilsCrossed className="h-[22px] w-[22px]" />
              </span>
              <div className="min-w-0">
                <DialogTitle>{editing ? t('meal.title.edit') : t('meal.title.log')}</DialogTitle>
                <DialogDescription>{t('meal.description')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            {/* ── photo scan ─────────────────────────────────────────────── */}
            <div className="bg-secondary/50 rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                  <Camera className="text-volt-ink h-3.5 w-3.5" />
                  {t('meal.photo.title')}
                  {!pro && (
                    <Badge variant="secondary" className="gap-1 normal-case">
                      <Crown className="h-3 w-3" /> Pro
                    </Badge>
                  )}
                </p>
                {photoBusy && (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('meal.photo.scanning')}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3">
                {photo && (
                  <div className="relative">
                    {/* A local preview: the athlete sees exactly what is sent. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/10"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setPhoto(null)}
                      className="bg-background absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow ring-1 ring-black/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex flex-1 flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      void onPhotoPicked(e.target.files?.[0]);
                      // Reset so picking the same file twice still fires.
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={photoBusy}
                    onClick={() => {
                      if (!pro) {
                        closeModal();
                        openWith({ kind: 'pro' });
                        return;
                      }
                      fileRef.current?.click();
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    {photo ? t('meal.photo.replace') : t('meal.photo.cta')}
                  </Button>
                  {voiceSupported && (
                    <Button
                      type="button"
                      variant={listening ? 'default' : 'outline'}
                      className="shrink-0"
                      aria-pressed={listening}
                      onClick={toggleVoice}
                    >
                      <Mic className={listening ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
                      {listening ? t('meal.voice.listening') : t('meal.voice.cta')}
                    </Button>
                  )}
                </div>
              </div>

              {heard && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {t('meal.voice.heard', { text: heard })}
                </p>
              )}
              {voiceNote && <p className="text-muted-foreground mt-2 text-xs">{voiceNote}</p>}
              {(photoAvailable || photo) && (
                <p className="text-muted-foreground mt-2 text-[11px]">{t('meal.photo.privacy')}</p>
              )}
            </div>

            {/* ── text scan ──────────────────────────────────────────────── */}
            <div className="bg-secondary/50 rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                  <Sparkles className="text-volt-ink h-3.5 w-3.5" />
                  {t('meal.scan.title')}
                  {!pro && (
                    <Badge variant="secondary" className="gap-1 normal-case">
                      <Crown className="h-3 w-3" /> Pro
                    </Badge>
                  )}
                </p>
                {scanned && <Badge variant="accent">Scanned</Badge>}
              </div>
              <div className="flex gap-2">
                <Input
                  value={scanText}
                  onChange={(e) => {
                    setScanText(e.target.value);
                    setScanHint(null);
                    setHeard(null);
                  }}
                  placeholder={t('meal.scan.placeholder')}
                  aria-label={t('meal.scan.input')}
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={runScan}>
                  {t('meal.scan.cta')}
                </Button>
              </div>

              {scan && scan.lines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scan.lines.map((line, index) => {
                    const food = foodById(line.id);
                    const alternative = swapAlternatives(line.id, state, { limit: 1 })[0];
                    return (
                      <span key={`${line.id}-${index}`} className="inline-flex items-center">
                        {/* The label carries the portion ("chicken 200 g"), so
                            the athlete can check the amount, not just the food. */}
                        <Badge variant="secondary" className="rounded-r-none">
                          {line.label}
                        </Badge>
                        {alternative && (
                          <button
                            type="button"
                            title={`${t('action.swap')} → ${foodLabel(alternative.food.id, locale)}`}
                            onClick={() => swapLine(index)}
                            className="bg-secondary text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-r-full border-l border-black/10 px-1.5 py-0.5 text-[10px] font-bold focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {t('action.swap')}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              {scanHint && <p className="text-muted-foreground mt-2 text-xs">{scanHint}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="m-date" label={t('meal.field.date')}>
                <DatePicker
                  value={date}
                  onValueChange={setDate}
                  weekStartsOn={state.profile.weekStartsOn ?? 1}
                />
              </Field>
              <Field id="m-slot" label={t('meal.field.slot')}>
                <Select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                  {MEAL_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t(`fuel.slot.${s.id}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field id="m-name" label={t('meal.field.name')} error={error ?? undefined}>
              <Input
                autoFocus
                placeholder="e.g. Chicken & rice"
                value={name}
                maxLength={80}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                required
              />
            </Field>

            {/* Where this meal lands in the day — the whole point of logging it. */}
            {targets && (
              <p className="text-muted-foreground text-xs">
                {targets.calories - soFar.calories - (Number(calories) || 0) >= 0
                  ? `${targets.calories - soFar.calories - (Number(calories) || 0)} kcal left after this meal.`
                  : `${Math.abs(targets.calories - soFar.calories - (Number(calories) || 0))} kcal over target with this meal.`}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field id="m-kcal" label={t('meal.field.calories')}>
                <Input
                  type="number"
                  min={1}
                  step="any"
                  placeholder="450"
                  value={calories}
                  onChange={(e) => {
                    setCalories(e.target.value);
                    setScan(null);
                  }}
                  required
                />
              </Field>
              <Field id="m-protein" label={t('meal.field.protein')}>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="35"
                  value={protein}
                  onChange={(e) => {
                    setProtein(e.target.value);
                    setScan(null);
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="m-carbs" label={t('meal.field.carbs')}>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="40"
                  value={carbs}
                  onChange={(e) => {
                    setCarbs(e.target.value);
                    setScan(null);
                  }}
                />
              </Field>
              <Field id="m-fat" label={t('meal.field.fat')}>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="12"
                  value={fat}
                  onChange={(e) => {
                    setFat(e.target.value);
                    setScan(null);
                  }}
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="mt-6 sm:justify-between">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className="text-destructive hover:text-destructive w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" /> {t('action.delete')}
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                className="w-full sm:w-auto"
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editing ? t('action.save') : t('meal.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
