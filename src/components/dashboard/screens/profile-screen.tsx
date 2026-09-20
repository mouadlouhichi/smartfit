'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
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
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { ProBadge } from '../pro-badge';
import { AchievementWall } from '../achievement-wall';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ProfileTab = 'overview' | 'settings' | 'badges' | 'data';

const PROFILE_TABS: { key: ProfileTab; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: UserRound },
  { key: 'settings', label: 'Settings', icon: SlidersHorizontal },
  { key: 'badges', label: 'Badges', icon: Trophy },
  { key: 'data', label: 'Data', icon: Database },
];

export function ProfileScreen() {
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
  const achievements = useMemo(() => computeAchievements(state), [state]);
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
      const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartfit-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDataError(
        'The complete backup could not be loaded. Nothing was downloaded; check your connection and retry.',
      );
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
      setDataError(
        'The complete CSV could not be loaded. Nothing was downloaded; check your connection and retry.',
      );
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
        setImportError('That file isn’t a SmartFit export we can read.');
        return;
      }
      const total =
        parsed.sessions.length +
        parsed.goals.length +
        parsed.schedule.length +
        parsed.bodyLogs.length;
      const ok = await confirmDialog({
        title: 'Replace everything with this backup?',
        body: `The backup holds ${total} record${total === 1 ? '' : 's'}. Your current data will be overwritten — this cannot be undone.`,
        confirmLabel: 'Replace data',
        destructive: true,
      });
      if (!ok) return;
      await replaceState(parsed);
    } catch {
      setImportError('We couldn’t read that file.');
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
            ? err.message || 'We could not finish deleting your account. Retry to continue.'
            : 'We could not finish deleting your account. Retry to continue the server deletion job.',
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeAccount() {
    const ok = await confirmDialog({
      title: 'Delete your account?',
      body: 'Your training data and sign-in credentials will be erased for good. Export a backup first if you might ever want it. This cannot be undone.',
      confirmLabel: 'Delete account',
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
      title: 'Erase all your SmartFit data?',
      body: 'Workouts, goals, schedule and measurements will be deleted and the app resets to a fresh start. This cannot be undone.',
      confirmLabel: 'Erase everything',
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
      <section className="card-hero max-w-full min-w-0 p-4 sm:p-8" aria-label="Profile summary">
        <p className="text-volt-ink mb-3 text-[11px] font-bold tracking-[0.18em] uppercase">
          Profile
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
                {displayName || 'Profile & settings'}
              </h1>
              {pro && <ProBadge className="shrink-0" />}
            </div>
            <p className="hero-muted mt-0.5 text-sm">
              {cloud
                ? `Signed in${user?.email ? ` as ${user.email}` : ''} — your training syncs to the cloud.`
                : 'Your data stays on this device — no account needed.'}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              {cloud ? (
                <Cloud className="text-primary h-3.5 w-3.5" aria-hidden />
              ) : (
                <HardDrive className="text-primary h-3.5 w-3.5" aria-hidden />
              )}
              {cloud ? 'Cloud synced' : 'Local mode'}
            </span>
            {streak > 0 && (
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Flame className="text-primary h-3.5 w-3.5" aria-hidden />
                {streak}-day streak
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            { label: 'Workouts', value: counts.workouts, icon: Database },
            { label: 'Scheduled', value: counts.scheduled, icon: CalendarCheck2 },
            { label: 'Goals', value: counts.goals, icon: Target },
            { label: 'Measurements', value: counts.measurements, icon: SlidersHorizontal },
            { label: 'Meals', value: state.meals.length, icon: UtensilsCrossed },
          ].map((t, i) => (
            <div
              key={t.label}
              className={cn(
                'hero-tile min-w-0 rounded-2xl px-4 py-3',
                i === 4 && 'col-span-2 sm:col-span-1',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="hero-muted min-w-0 text-[11px] font-semibold tracking-wide uppercase">
                  {t.label}
                </p>
                <t.icon className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
              </div>
              <p className="font-display mt-1 text-xl font-extrabold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div
        className="bg-secondary border-border no-scrollbar mx-auto flex w-full max-w-xl min-w-0 overflow-x-auto rounded-full border p-1 shadow-sm sm:w-fit"
        role="tablist"
        aria-label="Profile sections"
      >
        {PROFILE_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors',
              tab === t.key
                ? 'bg-volt text-ink shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
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
              Account
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
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Button>
              </div>
            </div>

            <div className="bg-secondary/60 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-xs">
              {syncStatus === 'error' ? (
                <>
                  <CloudOff className="text-destructive h-4 w-4" />
                  <span className="text-muted-foreground min-w-0 flex-1">
                    {syncError ?? 'Some changes haven’t reached the cloud.'}
                  </span>
                  <Button size="sm" variant="outline" onClick={retrySync}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                </>
              ) : syncStatus === 'saving' ? (
                <>
                  <Loader2 className="text-primary h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">Saving…</span>
                </>
              ) : (
                <>
                  <Cloud className="text-primary h-4 w-4" />
                  <span className="text-muted-foreground">All changes saved.</span>
                </>
              )}
            </div>

            {isPasswordUser && user && !user.emailVerified && (
              <div className="bg-secondary/60 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-xs">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground min-w-0 flex-1">
                  {verifySent
                    ? 'Verification email sent — check your inbox.'
                    : 'Email not verified yet. We sent a link when you signed up.'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={verifySent}
                  onClick={() => void resendEmail()}
                >
                  {verifySent ? 'Sent' : 'Resend email'}
                </Button>
              </div>
            )}

            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground text-xs">
                Deleting your account erases your training data and sign-in credentials for good.
              </p>
              {authError && <p className="text-destructive mt-1 text-xs">{authError}</p>}
              {deleteError && <p className="text-destructive mt-1 text-xs">{deleteError}</p>}
              {needPassword ? (
                <form onSubmit={submitPassword} className="mt-2 grid gap-2">
                  <Label htmlFor="del-password">
                    Confirm your password to delete the account
                    <span className="text-muted-foreground block font-normal">
                      For your security Firebase needs a fresh sign-in before an account can be
                      deleted.
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
                      Delete for good
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
                      Cancel
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
                  Delete account
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
              You
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="p-name" label="Name">
              <Input
                value={state.profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder="Your name"
                maxLength={80}
              />
            </Field>
            <Field id="p-plan" label="Default strategy">
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
                    <p className="text-sm font-bold">Gym Management</p>
                    <p className="text-muted-foreground text-xs">
                      {state.customGyms?.length
                        ? `${state.customGyms.length} custom gyms · ${state.customGyms.reduce((a, g) => a + g.programs.length, 0)} programs`
                        : 'Add your gyms, create programs, join AI-powered courses'}
                    </p>
                  </div>
                </div>
                <Button size="sm" asChild className="rounded-full">
                  <Link href="/dashboard/plan">
                    Manage <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <Field
              id="p-weight"
              label="Weight unit"
              hint={`Body measurements follow this: ${
                state.profile.weightUnit === 'kg' ? 'cm' : 'inches'
              }.`}
            >
              <Select
                value={state.profile.weightUnit}
                onChange={(e) => changeWeightUnit(e.target.value as 'kg' | 'lb')}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </Select>
            </Field>
            <Field
              id="p-target-weight"
              label={`Target weight (${state.profile.weightUnit})`}
              hint="Drives the suggested program mix — closer target means more maintenance, further means more burn. Clear to disable."
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
                placeholder="e.g. 78"
              />
            </Field>
            <Field id="p-distance" label="Distance unit">
              <Select
                value={state.profile.distanceUnit}
                onChange={(e) => updateProfile({ distanceUnit: e.target.value as 'km' | 'mi' })}
              >
                <option value="km">Kilometres (km)</option>
                <option value="mi">Miles (mi)</option>
              </Select>
            </Field>
            <Field
              id="p-weekstart"
              label="Week starts on"
              hint='Used for weekly goals, streaks and every "this week" total.'
            >
              <Select
                value={state.profile.weekStartsOn ?? 1}
                onChange={(e) =>
                  updateProfile({ weekStartsOn: Number(e.target.value) as WeekStart })
                }
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </Field>
            <Field
              id="p-rest"
              label="Rest days / week"
              hint="Your streak survives this many untrained days a week."
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
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/dashboard/plan"
                className="hover:bg-secondary/50 flex items-center justify-between rounded-2xl border p-4 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold">Gym Management</p>
                  <p className="text-muted-foreground text-xs">Add gyms, programs, AI courses</p>
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/progress"
                className="hover:bg-secondary/50 flex items-center justify-between rounded-2xl border p-4 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold">View Progress</p>
                  <p className="text-muted-foreground text-xs">Check your growth & metrics</p>
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
                <p className="text-sm font-bold text-white">SmartFit Pro</p>
                <p className="truncate text-xs text-white/75">
                  {pro
                    ? `Active since ${formatDateLabel(toISODate(new Date(state.profile.pro?.since ?? Date.now())))} — thanks for supporting SmartFit.`
                    : 'Unlimited AI coach, quarter & year analytics, Pro badge.'}
                </p>
              </div>
              <Button
                size="sm"
                variant={pro ? 'outline' : 'default'}
                className={cn('relative', !pro && 'shadow-primary/40 shadow-lg')}
                onClick={() => openWith({ kind: 'pro' })}
              >
                {pro ? 'Manage' : 'Upgrade'}
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
              Badges
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
              Your data
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{counts.workouts} workouts</Badge>
              <Badge variant="secondary">{counts.scheduled} scheduled</Badge>
              <Badge variant="secondary">{counts.goals} goals</Badge>
              <Badge variant="secondary">{counts.measurements} measurements</Badge>
              <Badge variant="secondary">{state.categories.length} activity types</Badge>
              {state.customGyms && state.customGyms.length > 0 && (
                <Badge variant="secondary">{state.customGyms.length} custom gyms</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openModal('category')}>
                <Tag className="h-4 w-4" /> Activity types
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
                Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === 'export'}
                onClick={() => void exportCsv()}
                title="Download sessions as CSV"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV
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
                Import backup
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
                <Trash2 className="h-4 w-4" /> Erase everything
              </Button>
            </div>
            {importError && <p className="text-destructive text-xs">{importError}</p>}
            {dataError && <p className="text-destructive text-xs">{dataError}</p>}
            <p className="text-muted-foreground text-xs">
              {cloud
                ? 'Your training is stored in Cloud Firestore under your account and synced across devices, with an offline copy on this device. Export a JSON backup any time.'
                : mode === 'cloud'
                  ? 'You are signed out — data is stored in this browser’s local bucket until you sign in, then it syncs to the cloud. Anyone using this browser profile can see that local data.'
                  : 'SmartFit stores everything locally in this browser (localStorage). Anyone using this browser profile can see it; nothing is sent to a server. Export regularly for a backup.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
