'use client';

import { useMemo, useRef, useState } from 'react';
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
  Flame,
  Sparkles,
  HardDrive,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Target,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import {
  GYM_PROGRAMS,
  INTENSITY_META,
  PLANS,
  WEEKDAYS,
  currentStreak,
  formatDateLabel,
  formatWeight,
  fromKg,
  getGymProgram,
  isPro,
  parseStateJSON,
  toISODate,
  suggestProgram,
  suggestedToSchedule,
  suggestSummary,
  toKg,
} from '@smartfit/core';
import type { WeekStart } from '@smartfit/core';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/firebase/auth-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';

/** Initials for the hero avatar — falls back to an icon when nameless. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileScreen() {
  const {
    state,
    updateProfile,
    replaceSchedule,
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
  const [importError, setImportError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifySent, setVerifySent] = useState(false);
  // Target weight is stored canonically in kg but edited in the athlete's
  // display unit; the raw field keeps the typed value until it commits.
  const [targetInput, setTargetInput] = useState(() =>
    state.profile.targetWeightKg != null
      ? String(Number(fromKg(state.profile.targetWeightKg, state.profile.weightUnit).toFixed(1)))
      : '',
  );
  const [targetError, setTargetError] = useState<string | null>(null);

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
    // Surface the valid range instead of silently clamping what was typed.
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

  // Gym-aware suggested week — this preview mirrors the Plan tab exactly.
  const gymProgram = useMemo(() => getGymProgram(state.profile.gymId), [state.profile.gymId]);
  const suggested = useMemo(
    () => (gymProgram ? suggestProgram(state, gymProgram) : []),
    [state, gymProgram],
  );

  async function importSuggestion() {
    const ok = await confirmDialog({
      title: 'Import suggested week?',
      body: `Your current scheduled sessions are replaced with the ${
        gymProgram?.name ?? 'gym'
      } classes shown here.`,
      confirmLabel: 'Replace my week',
      destructive: true,
    });
    if (ok) {
      replaceSchedule(suggestedToSchedule(suggested));
      toast(`Week imported — ${suggested.length} sessions scheduled`);
    }
  }

  const pro = isPro(state);
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

  async function exportData() {
    setBusy('export');
    try {
      // Pages through any history the initial bounded load left in the cloud,
      // so the backup is complete even for multi-year accounts.
      const full = await collectFullState();
      const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartfit-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  /** Import validates through the shared parser — never a raw JSON cast. */
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
    try {
      // Prove the password *before* wiping data: a wrong password must never
      // leave behind an empty-but-alive account.
      if (pw !== undefined) await reauthenticate(pw);
      // Data first — the security rules require an authenticated user.
      await clearData();
      await deleteAccount();
      window.location.href = '/';
    } catch (err) {
      // Firebase demanded a fresh login we don't have: fall back to asking
      // for the password inline instead of dead-ending the user.
      if ((err as { code?: string })?.code === 'auth/requires-recent-login') {
        setNeedPassword(true);
      }
      // Anything else is already surfaced via authError below the button.
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
    // Password users confirm with their password; Google users only get a
    // re-auth popup if Firebase actually demands one.
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
    <div className="grid gap-5">
      {/* ── Hero identity card ─────────────────────────────────────────── */}
      <section className="card-hero p-6 sm:p-8" aria-label="Profile summary">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="hero-tile flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-extrabold"
            style={{ boxShadow: '0 0 0 4px rgba(224,94,54,0.25)' }}
            aria-hidden
          >
            {avatar || <UserRound className="h-7 w-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-xl font-extrabold tracking-tight sm:text-2xl">
              {displayName || 'Profile & settings'}
            </h1>
            <p className="hero-muted mt-0.5 text-sm">
              {cloud
                ? `Signed in${user?.email ? ` as ${user.email}` : ''} — your training syncs to the cloud.`
                : 'Your data stays on this device — no account needed.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              {cloud ? (
                <Cloud className="h-3.5 w-3.5 text-[#f0a37f]" aria-hidden />
              ) : (
                <HardDrive className="h-3.5 w-3.5 text-[#f0a37f]" aria-hidden />
              )}
              {cloud ? 'Cloud synced' : 'Local mode'}
            </span>
            {streak > 0 && (
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Flame className="h-3.5 w-3.5 text-[#f0a37f]" aria-hidden />
                {streak}-day streak
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: 'Workouts', value: counts.workouts, icon: Database },
            { label: 'Scheduled', value: counts.scheduled, icon: CalendarCheck2 },
            { label: 'Goals', value: counts.goals, icon: Target },
            { label: 'Measurements', value: counts.measurements, icon: SlidersHorizontal },
          ].map((t) => (
            <div key={t.label} className="hero-tile rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="hero-muted text-[11px] font-semibold tracking-wide uppercase">
                  {t.label}
                </p>
                <t.icon className="h-3.5 w-3.5 text-[#f0a37f]" aria-hidden />
              </div>
              <p className="font-display mt-1 text-xl font-extrabold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </section>

      {cloud && user && (
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
                <Button variant="outline" size="sm" onClick={() => void signOutAndForget()}>
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </div>

            {/* Sync health */}
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

            {/* Email verification (password accounts only — OAuth emails arrive verified) */}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-chart-2/10 text-chart-2 flex h-9 w-9 items-center justify-center rounded-xl">
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
          <Field
            id="p-gym"
            label="Gym program"
            hint="Picking your gym unlocks a suggested week built from its real class timetable."
          >
            <Select
              value={state.profile.gymId ?? ''}
              onChange={(e) => updateProfile({ gymId: e.target.value || undefined })}
            >
              <option value="">No gym — build my week manually</option>
              {GYM_PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="p-weight"
            label="Weight unit"
            hint={`Body measurements follow this: ${
              state.profile.weightUnit === 'kg' ? 'cm' : 'inches'
            }.`}
          >
            <Select
              value={state.profile.weightUnit}
              onChange={(e) => updateProfile({ weightUnit: e.target.value as 'kg' | 'lb' })}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </Select>
          </Field>
          <Field
            id="p-target-weight"
            label={`Target weight (${state.profile.weightUnit})`}
            hint="Drives the suggested program mix on the Plan tab — closer target means more maintenance, further means more burn. Clear to disable."
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
              onChange={(e) => updateProfile({ weekStartsOn: Number(e.target.value) as WeekStart })}
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

          {/* Live suggested-week preview — appears the moment a gym is picked */}
          {gymProgram && (
            <div className="bg-secondary/40 grid gap-3 rounded-2xl p-4 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                    <Sparkles className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Suggested week · {gymProgram.name}</p>
                    <p className="text-muted-foreground text-xs">{suggestSummary(state)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={importSuggestion}
                  disabled={suggested.length === 0}
                  data-testid="import-suggested-week"
                >
                  <Download className="h-4 w-4" /> Import into my plan
                </Button>
              </div>
              {suggested.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No matching classes on your training days — try another default strategy.
                </p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {suggested.map((s) => {
                    const meta = INTENSITY_META[s.gymClass.intensity];
                    return (
                      <li
                        key={`${s.weekday}-${s.time}-${s.gymClass.id}`}
                        className="bg-card flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="w-8 text-xs font-bold tabular-nums">
                          {WEEKDAYS[s.weekday]}
                        </span>
                        <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                          {s.time}
                        </span>
                        <span className="flex-1 truncate text-xs font-semibold">
                          {s.gymClass.name}
                        </span>
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.color }}
                          title={`${meta.label} intensity`}
                          aria-hidden
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">
                {gymProgram.hours} · Fine-tune any session on the Plan tab after importing.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SmartFit Pro — membership status & paywall entry */}
      <Card className="overflow-hidden">
        <div className="relative flex flex-wrap items-center gap-4 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
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
                ? `Member since ${formatDateLabel(toISODate(new Date(state.profile.pro?.since ?? Date.now())))} — thanks for supporting SmartFit.`
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-chart-4/10 text-chart-4 flex h-9 w-9 items-center justify-center rounded-xl">
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
          <p className="text-muted-foreground text-xs">
            {cloud
              ? 'Your training is stored in Cloud Firestore under your account and synced across devices, with an offline copy on this device. Export a JSON backup any time.'
              : mode === 'cloud'
                ? 'You are signed out — data is stored locally in this browser until you sign in, then it syncs to the cloud.'
                : 'SmartFit stores everything locally in your browser (localStorage). Nothing is sent to a server, and there are no trackers. Export any time for a backup.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
