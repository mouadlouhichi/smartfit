'use client';

import { useRef, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Cloud,
  CloudOff,
  Database,
  Download,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Tag,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { PLANS, parseStateJSON } from '@smartfit/core';
import type { WeekStart } from '@smartfit/core';
import { useAuth } from '@/lib/firebase/auth-context';
import { useConfirm } from '../confirm-context';

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
  const { openModal } = useModals();
  const confirmDialog = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'delete' | 'import' | 'export'>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifySent, setVerifySent] = useState(false);

  const counts = {
    workouts: state.sessions.length,
    scheduled: state.schedule.length,
    goals: state.goals.length,
    measurements: state.bodyLogs.length,
  };

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
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Profile &amp; settings</h1>
        <p className="text-muted-foreground text-sm">
          {cloud
            ? `Signed in${user?.email ? ` as ${user.email}` : ''} — your training syncs to the cloud.`
            : 'Your data stays on this device — no account needed.'}
        </p>
      </div>

      {cloud && user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="text-primary h-4 w-4" /> Account
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
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="text-primary h-4 w-4" /> You
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={state.profile.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              placeholder="Your name"
              maxLength={80}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-plan">Default strategy</Label>
            <Select
              id="p-plan"
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
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-weight">Weight unit</Label>
            <Select
              id="p-weight"
              value={state.profile.weightUnit}
              onChange={(e) => updateProfile({ weightUnit: e.target.value as 'kg' | 'lb' })}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </Select>
            <p className="text-muted-foreground text-xs">
              Body measurements follow this: {state.profile.weightUnit === 'kg' ? 'cm' : 'inches'}.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-distance">Distance unit</Label>
            <Select
              id="p-distance"
              value={state.profile.distanceUnit}
              onChange={(e) => updateProfile({ distanceUnit: e.target.value as 'km' | 'mi' })}
            >
              <option value="km">Kilometres (km)</option>
              <option value="mi">Miles (mi)</option>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-weekstart">Week starts on</Label>
            <Select
              id="p-weekstart"
              value={state.profile.weekStartsOn ?? 1}
              onChange={(e) => updateProfile({ weekStartsOn: Number(e.target.value) as WeekStart })}
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
            <p className="text-muted-foreground text-xs">
              Used for weekly goals, streaks and every &quot;this week&quot; total.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-rest">Rest days / week</Label>
            <Select
              id="p-rest"
              value={state.profile.weeklyRestDays}
              onChange={(e) => updateProfile({ weeklyRestDays: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <p className="text-muted-foreground text-xs">
              Your streak survives this many untrained days a week.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="text-primary h-4 w-4" /> Your data
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
