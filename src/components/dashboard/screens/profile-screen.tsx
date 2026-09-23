'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { useTablist } from '@/components/ui/use-tablist';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CalendarCheck2,
  Cloud,
  CloudOff,
  Crown,
  Database,
  Download,
  FileSpreadsheet,
  Flame,
  Building2,
  HardDrive,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Target,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  UtensilsCrossed,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import {
  PLANS,
  computeAchievements,
  translateAchievements,
  currentStreak,
  formatDateLabel,
  formatWeight,
  fromKg,
  hasProAccess,
  parseStateJSON,
  toISODate,
  toKg,
} from '@smartfit/core';
import type { WeekStart } from '@smartfit/core';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/firebase/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ProBadge } from '../pro-badge';
import { AchievementWall } from '../achievement-wall';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ProfileTab = 'overview' | 'settings' | 'badges' | 'data';

const PROFILE_TABS: { key: ProfileTab; labelKey: string; icon: LucideIcon }[] = [
  { key: 'overview', labelKey: 'profile.tab.overview', icon: UserRound },
  { key: 'settings', labelKey: 'profile.tab.settings', icon: SlidersHorizontal },
  { key: 'badges', labelKey: 'profile.tab.badges', icon: Trophy },
  { key: 'data', labelKey: 'profile.tab.data', icon: Database },
];

export function ProfileScreen() {
  const { t, locale } = useI18n();
  const {
    state,
    updateProfile,
    clearData,
    replaceState,
    cloud,
    syncStatus,
    syncError,
    retrySync,
    signOutAndForget,
    collectFullState,
  } = useStore();
  const { user, mode, deleteAccount, reauthenticate, resendVerification, authError } = useAuth();
  const { openModal, openWith } = useModals();
  const confirmDialog = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'delete' | 'import' | 'export'>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const profileTabs = useTablist(PROFILE_TABS.length);
  // Core emits keys; the active translator turns them into the wall's copy.
  const achievements = useMemo(
    () => translateAchievements(computeAchievements(state), t),
    [state, t],
  );
  const [targetInput, setTargetInput] = useState(() =>
    state.profile.targetWeightKg != null
      ? String(Number(fromKg(state.profile.targetWeightKg, state.profile.weightUnit).toFixed(1)))
      : '',
  );
  const [targetError, setTargetError] = useState<string | null>(null);

  function changeWeightUnit(next: 'kg' | 'lb') {
    if (state.profile.targetWeightKg != null) {
      setTargetInput(String(Number(fromKg(state.profile.targetWeightKg, next).toFixed(1))));
    }
    setTargetError(null);
    updateProfile({ weightUnit: next });
  }

  function commitTargetWeight() {
    const trimmed = targetInput.trim();
    if (trimmed === '') {
      setTargetError(null);
      if (state.profile.targetWeightKg !== undefined) {
        updateProfile({ targetWeightKg: undefined });
      }
      return;
    }
    const n = Number(trimmed);
    const kg = toKg(n, state.profile.weightUnit);
    if (!Number.isFinite(n) || kg < 20 || kg > 400) {
      const unit = state.profile.weightUnit;
      setTargetError(
        `Enter a target between ${formatWeight(20, unit)} and ${formatWeight(400, unit)}.`,
      );
      return;
    }
    const rounded = Math.round(kg * 10) / 10;
    setTargetError(null);
    updateProfile({ targetWeightKg: rounded });
    setTargetInput(String(Number(fromKg(rounded, state.profile.weightUnit).toFixed(1))));
  }

  const pro = hasProAccess(state);
  const counts = {
    workouts: state.sessions.length,
    scheduled: state.schedule.length,
    goals: state.goals.length,
    measurements: state.bodyLogs.length,
  };
  const streak = currentStreak(state);
  const displayName = state.profile.name || user?.displayName || user?.email || '';
  const avatar = initials(displayName);
  const isPasswordUser = !!user?.providerData.some((p) => p.providerId === 'password');

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutAndForget();
    } finally {
      setSigningOut(false);
    }
  }

  async function exportData() {
    setBusy('export');
    setDataError(null);
    try {
      const full = await collectFullState();
      let serviceData: unknown;
      if (cloud && user) {
        const response = await fetch('/api/account/export', {
          headers: { authorization: `Bearer ${await user.getIdToken()}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Supplementary account export failed.');
        serviceData = await response.json();
      }
      const blob = new Blob(
        [JSON.stringify({ ...full, ...(serviceData ? { serviceData } : {}) }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartfit-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDataError(t('profile.error.export'));
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv() {
    setBusy('export');
    setDataError(null);
    try {
      const full = await collectFullState();
      const rows = [
        'date,title,category,exercise,set,reps,weight_kg,distance_km,duration_min,intensity,calories,set_type,rpe',
      ];
      for (const s of full.sessions) {
        const cat = full.categories.find((c) => c.id === s.categoryId)?.name ?? s.categoryId;
        if (s.exercises.length === 0) {
          rows.push(
            csvRow([
              s.date,
              s.title,
              cat,
              '',
              '',
              '',
              '',
              '',
              s.durationMin,
              s.intensity,
              s.calories,
              '',
              '',
            ]),
          );
        } else {
          for (const ex of s.exercises) {
            ex.sets.forEach((set, i) => {
              rows.push(
                csvRow([
                  s.date,
                  s.title,
                  cat,
                  ex.name,
                  i + 1,
                  set.reps ?? '',
                  set.weight ?? '',
                  set.distance ?? '',
                  s.durationMin,
                  s.intensity,
                  s.calories,
                  set.kind ?? 'working',
                  set.rpe ?? '',
                ]),
              );
            });
          }
        }
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartfit-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV downloaded');
    } catch {
      setDataError(t('profile.error.exportCsv'));
    } finally {
      setBusy(null);
    }
  }

  function csvRow(values: (string | number)[]): string {
    return values
      .map((v) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(',');
  }

  async function importData(file: File) {
    setImportError(null);
    setBusy('import');
    try {
      const parsed = parseStateJSON(await file.text());
      if (!parsed) {
        setImportError(t('profile.error.notSmartfit'));
        return;
      }
      const total =
        parsed.sessions.length +
        parsed.goals.length +
        parsed.schedule.length +
        parsed.bodyLogs.length;
      const ok = await confirmDialog({
        title: t('profile.import.title'),
        body: `The backup holds ${total} record${total === 1 ? '' : 's'}. Your current data will be overwritten — this cannot be undone.`,
        confirmLabel: t('profile.import.confirm'),
        destructive: true,
      });
      if (!ok) return;
      await replaceState(parsed);
    } catch {
      setImportError(t('profile.error.unreadable'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function executeDeletion(pw?: string) {
    setBusy('delete');
    setDeleteError(null);
    try {
      await reauthenticate(pw);
      await deleteAccount();
      window.location.href = '/';
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/requires-recent-login') {
        setNeedPassword(true);
      } else {
        setDeleteError(
          err instanceof Error
            ? err.message || t('profile.error.delete')
            : t('profile.error.deleteServer'),
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeAccount() {
    const ok = await confirmDialog({
      title: t('profile.deleteDialog.title'),
      body: t('profile.deleteDialog.body'),
      confirmLabel: t('profile.deleteDialog.confirm'),
      destructive: true,
    });
    if (!ok) return;
    if (isPasswordUser) {
      setNeedPassword(true);
      return;
    }
    await executeDeletion();
  }

  function submitPassword(f: React.FormEvent) {
    f.preventDefault();
    const pw = password;
    if (!pw) return;
    setPassword('');
    void executeDeletion(pw);
  }

  async function eraseEverything() {
    const ok = await confirmDialog({
      title: t('profile.eraseDialog.title'),
      body: t('profile.eraseDialog.body'),
      confirmLabel: t('profile.eraseDialog.confirm'),
      destructive: true,
    });
    if (ok) await clearData();
  }

  async function resendEmail() {
    await resendVerification();
    setVerifySent(true);
  }

  return (
    <div className="grid max-w-full min-w-0 gap-5">
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/personalize">{t('profile.preferences')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/coaching">{t('profile.coaching')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/support">{t('profile.support')}</Link>
        </Button>
      </div>
      <section
        className="card-hero max-w-full min-w-0 p-4 sm:p-8"
        aria-label={t('profile.summaryAria')}
      >
        <p className="text-volt-ink mb-3 text-[11px] font-bold tracking-[0.18em] uppercase">
          {t('profile.eyebrow')}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
          <span
            className="hero-tile flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-extrabold"
            style={{ boxShadow: '0 0 0 4px rgba(138,210,0,0.25)' }}
            aria-hidden
          >
            {avatar || <UserRound className="h-7 w-7" />}
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="font-display min-w-0 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                {displayName || t('profile.eyebrow')}
              </h1>
              {pro && <ProBadge className="shrink-0" />}
            </div>
            <p className="hero-muted mt-0.5 text-sm">
              {cloud
                ? t('profile.signedIn', {
                    as: user?.email ? t('profile.signedInAs', { email: user.email }) : '',
                  })
                : t('profile.localOnly')}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              {cloud ? (
                <Cloud className="text-primary h-3.5 w-3.5" aria-hidden />
              ) : (
                <HardDrive className="text-primary h-3.5 w-3.5" aria-hidden />
              )}
              {cloud ? t('profile.cloudSynced') : t('profile.localMode')}
            </span>
            {streak > 0 && (
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Flame className="text-primary h-3.5 w-3.5" aria-hidden />
                {t('profile.streak', { days: streak })}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            { labelKey: 'profile.stat.workouts', value: counts.workouts, icon: Database },
            { labelKey: 'profile.stat.scheduled', value: counts.scheduled, icon: CalendarCheck2 },
            { labelKey: 'profile.stat.goals', value: counts.goals, icon: Target },
            {
              labelKey: 'profile.stat.measurements',
              value: counts.measurements,
              icon: SlidersHorizontal,
            },
            { labelKey: 'profile.stat.meals', value: state.meals.length, icon: UtensilsCrossed },
          ].map((stat, i) => (
            <div
              key={stat.labelKey}
              className={cn(
                'hero-tile min-w-0 rounded-2xl px-4 py-3',
                i === 4 && 'col-span-2 sm:col-span-1',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="hero-muted min-w-0 text-[11px] font-semibold tracking-wide uppercase">
                  {t(stat.labelKey)}
                </p>
                <stat.icon className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
              </div>
              <p className="font-display mt-1 text-xl font-extrabold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div
        className="bg-secondary border-border no-scrollbar mx-auto flex w-full max-w-xl min-w-0 overflow-x-auto rounded-full border p-1 shadow-sm sm:w-fit"
        role="tablist"
        aria-label={t('profile.sectionsAria')}
      >
        {PROFILE_TABS.map((tabItem, i) => (
          <button
            key={tabItem.key}
            ref={profileTabs.setRef(i)}
            role="tab"
            aria-selected={tab === tabItem.key}
            tabIndex={tab === tabItem.key ? 0 : -1}
            onKeyDown={(e) => profileTabs.onKeyDown(e, i)}
            onClick={() => setTab(tabItem.key)}
            className={cn(
              'flex flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors',
              tab === tabItem.key
                ? 'bg-volt text-ink shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tabItem.icon className="h-4 w-4" aria-hidden />
            {t(tabItem.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview' && cloud && user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
                <Cloud className="h-4.5 w-4.5" aria-hidden />
              </span>
              {t('profile.account')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {state.profile.name || user.displayName || user.email}
                </p>
                {(state.profile.name || user.displayName) && (
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={signingOut || busy !== null}
                  onClick={() => void handleSignOut()}
                >
                  {signingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  {signingOut ? t('profile.signingOut') : t('profile.signOut')}
                </Button>
              </div>
            </div>

            <div className="bg-secondary/60 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-xs">
              {syncStatus === 'error' ? (
                <>
                  <CloudOff className="text-destructive h-4 w-4" />
                  <span className="text-muted-foreground min-w-0 flex-1">
                    {syncError ?? t('profile.syncError')}
                  </span>
                  <Button size="sm" variant="outline" onClick={retrySync}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t('profile.sync.retry')}
                  </Button>
                </>
              ) : syncStatus === 'saving' ? (
                <>
                  <Loader2 className="text-primary h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">{t('profile.sync.saving')}</span>
                </>
              ) : (
                <>
                  <Cloud className="text-primary h-4 w-4" />
                  <span className="text-muted-foreground">{t('profile.sync.saved')}</span>
                </>
              )}
            </div>

            {isPasswordUser && user && !user.emailVerified && (
              <div className="bg-secondary/60 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-xs">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground min-w-0 flex-1">
                  {verifySent ? t('profile.verify.sent') : t('profile.verify.pending')}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={verifySent}
                  onClick={() => void resendEmail()}
                >
                  {verifySent ? t('profile.verify.resent') : t('profile.verify.resend')}
                </Button>
              </div>
            )}

            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground text-xs">{t('profile.delete.blurb')}</p>
              {authError && <p className="text-destructive mt-1 text-xs">{authError}</p>}
              {deleteError && <p className="text-destructive mt-1 text-xs">{deleteError}</p>}
              {needPassword ? (
                <form onSubmit={submitPassword} className="mt-2 grid gap-2">
                  <Label htmlFor="del-password">
                    {t('profile.delete.confirmLabel')}
                    <span className="text-muted-foreground block font-normal">
                      {t('profile.delete.confirmHint')}
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="del-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="min-w-0 flex-1"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={!password || busy !== null}
                    >
                      {busy === 'delete' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {t('profile.delete.forGood')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => {
                        setNeedPassword(false);
                        setPassword('');
                      }}
                    >
                      {t('profile.cancel')}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void removeAccount()}
                  className="text-destructive hover:text-destructive mt-2"
                >
                  {busy === 'delete' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {t('profile.delete.cta')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="bg-chart-2/10 text-foreground flex h-9 w-9 items-center justify-center rounded-xl">
                <UserRound className="h-4.5 w-4.5" aria-hidden />
              </span>
              {t('profile.settings.you')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="p-name" label={t('profile.field.name')}>
              <Input
                value={state.profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder={t('profile.field.namePlaceholder')}
                maxLength={80}
              />
            </Field>
            <Field id="p-plan" label={t('profile.field.strategy')}>
              <Select
                value={state.profile.planId}
                onChange={(e) =>
                  updateProfile({ planId: e.target.value as typeof state.profile.planId })
                }
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="bg-volt/5 border-volt/20 rounded-2xl border p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="bg-volt text-ink grid h-10 w-10 place-items-center rounded-xl">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{t('profile.gym.title')}</p>
                    <p className="text-muted-foreground text-xs">{t('profile.gym.blurb')}</p>
                  </div>
                </div>
                <Button size="sm" asChild className="rounded-full">
                  <Link href="/dashboard/plan">
                    {t('profile.gym.choose')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <Field
              id="p-weight"
              label={t('profile.field.weightUnit')}
              hint={t('profile.field.weightUnitHint', {
                unit:
                  state.profile.weightUnit === 'kg'
                    ? t('profile.field.weightUnitHintKg')
                    : t('profile.field.weightUnitHintLb'),
              })}
            >
              <Select
                value={state.profile.weightUnit}
                onChange={(e) => changeWeightUnit(e.target.value as 'kg' | 'lb')}
              >
                <option value="kg">{t('profile.unit.kilograms')}</option>
                <option value="lb">{t('profile.unit.pounds')}</option>
              </Select>
            </Field>
            <Field
              id="p-target-weight"
              label={t('profile.field.targetWeight', { unit: state.profile.weightUnit })}
              hint={t('profile.field.targetWeightHint')}
              error={targetError}
            >
              <Input
                type="number"
                min={20}
                max={400}
                step="0.5"
                inputMode="decimal"
                value={targetInput}
                onChange={(e) => {
                  setTargetInput(e.target.value);
                  setTargetError(null);
                }}
                onBlur={commitTargetWeight}
                placeholder={t('profile.field.targetWeightPlaceholder')}
              />
            </Field>
            <Field id="p-distance" label={t('profile.field.distanceUnit')}>
              <Select
                value={state.profile.distanceUnit}
                onChange={(e) => updateProfile({ distanceUnit: e.target.value as 'km' | 'mi' })}
              >
                <option value="km">{t('profile.unit.kilometres')}</option>
                <option value="mi">{t('profile.unit.miles')}</option>
              </Select>
            </Field>
            <Field
              id="p-weekstart"
              label={t('profile.field.weekStart')}
              hint={t('profile.field.weekStartHint')}
            >
              <Select
                value={state.profile.weekStartsOn ?? 1}
                onChange={(e) =>
                  updateProfile({ weekStartsOn: Number(e.target.value) as WeekStart })
                }
              >
                <option value={1}>{t('profile.weekday.monday')}</option>
                <option value={0}>{t('profile.weekday.sunday')}</option>
              </Select>
            </Field>
            <Field
              id="p-rest"
              label={t('profile.field.restDays')}
              hint={t('profile.field.restDaysHint')}
            >
              <Select
                value={state.profile.weeklyRestDays}
                onChange={(e) => updateProfile({ weeklyRestDays: Number(e.target.value) })}
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            {/* Language sits with the other preferences rather than buried in
                the diet section: it changes every label on this screen. */}
            <div className="bg-secondary/40 rounded-2xl p-4 sm:col-span-2">
              <LocaleSwitcher header />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'overview' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="bg-volt/10 text-ink flex h-9 w-9 items-center justify-center rounded-xl">
                  <Building2 className="h-5 w-5" />
                </span>
                {t('profile.quick.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/dashboard/plan"
                className="hover:bg-secondary/50 flex items-center justify-between rounded-2xl border p-4 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold">{t('profile.gym.title')}</p>
                  <p className="text-muted-foreground text-xs">{t('profile.quick.gym')}</p>
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/progress"
                className="hover:bg-secondary/50 flex items-center justify-between rounded-2xl border p-4 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold">{t('profile.quick.progress')}</p>
                  <p className="text-muted-foreground text-xs">{t('profile.quick.progressBody')}</p>
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="relative flex flex-wrap items-center gap-4 p-5">
              <img
                src="/images/pro-hero.jpg"
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60" />
              <span className="bg-primary relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-lg shadow-black/30">
                <Crown className="h-5 w-5 text-white" aria-hidden />
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{t('profile.pro.title')}</p>
                <p className="truncate text-xs text-white/75">
                  {pro
                    ? t('profile.pro.activeSince', {
                        date: formatDateLabel(
                          toISODate(new Date(state.profile.pro?.since ?? Date.now())),
                          locale,
                        ),
                      })
                    : t('profile.pro.blurb')}
                </p>
              </div>
              <Button
                size="sm"
                variant={pro ? 'outline' : 'default'}
                className={cn('relative', !pro && 'shadow-primary/40 shadow-lg')}
                onClick={() => openWith({ kind: 'pro' })}
              >
                {pro ? t('profile.pro.manage') : t('profile.pro.upgrade')}
              </Button>
            </div>
          </Card>
        </>
      )}

      {tab === 'badges' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="bg-chart-3/10 text-foreground flex h-9 w-9 items-center justify-center rounded-xl">
                <Trophy className="h-4.5 w-4.5" aria-hidden />
              </span>
              {t('profile.tab.badges')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AchievementWall achievements={achievements} />
          </CardContent>
        </Card>
      )}

      {tab === 'data' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="bg-chart-4/10 text-foreground flex h-9 w-9 items-center justify-center rounded-xl">
                <Database className="h-4.5 w-4.5" aria-hidden />
              </span>
              {t('profile.tab.data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t('profile.data.workouts', { count: counts.workouts })}
              </Badge>
              <Badge variant="secondary">
                {t('profile.data.scheduled', { count: counts.scheduled })}
              </Badge>
              <Badge variant="secondary">{t('profile.data.goals', { count: counts.goals })}</Badge>
              <Badge variant="secondary">
                {t('profile.data.measurements', { count: counts.measurements })}
              </Badge>
              <Badge variant="secondary">
                {t('profile.data.activityTypes', { count: state.categories.length })}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openModal('category')}>
                <Tag className="h-4 w-4" /> {t('profile.data.types')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === 'export'}
                onClick={() => void exportData()}
              >
                {busy === 'export' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t('profile.data.exportJson')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === 'export'}
                onClick={() => void exportCsv()}
                title={t('profile.data.exportCsvTitle')}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('profile.data.exportCsv')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === 'import'}
                onClick={() => fileRef.current?.click()}
              >
                {busy === 'import' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {t('profile.data.import')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importData(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void eraseEverything()}
              >
                <Trash2 className="h-4 w-4" /> {t('profile.data.erase')}
              </Button>
            </div>
            {importError && <p className="text-destructive text-xs">{importError}</p>}
            {dataError && <p className="text-destructive text-xs">{dataError}</p>}
            <p className="text-muted-foreground text-xs">
              {cloud
                ? t('profile.data.blurbCloud')
                : mode === 'cloud'
                  ? t('profile.data.blurbSignedOut')
                  : t('profile.data.blurbLocal')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
