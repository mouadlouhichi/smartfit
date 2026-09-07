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
  RefreshCw,
  Tag,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { PLANS, parseStateJSON } from '@smartfit/core';
import type { WeekStart } from '@smartfit/core';
import { useAuth } from '@/lib/firebase/auth-context';

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
  } = useStore();
  const { user, mode, deleteAccount, authError } = useAuth();
  const { openModal } = useModals();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'delete' | 'import'>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const counts = {
    workouts: state.sessions.length,
    scheduled: state.schedule.length,
    goals: state.goals.length,
    measurements: state.bodyLogs.length,
  };

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartfit-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      if (
        !confirm(
          `Replace everything in SmartFit with this backup (${total} records)? Your current data will be overwritten.`,
        )
      )
        return;
      await replaceState(parsed);
    } catch {
      setImportError('We couldn’t read that file.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAccount() {
    if (
      !confirm('Permanently delete your account and all your training data? This cannot be undone.')
    )
      return;
    setBusy('delete');
    try {
      // Data first — the security rules require an authenticated user.
      await clearData();
      await deleteAccount();
      window.location.href = '/';
    } finally {
      setBusy(null);
    }
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
                  {user.displayName || state.profile.name || 'Athlete'}
                </p>
                <p className="text-muted-foreground truncate text-xs">{user.email}</p>
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

            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground text-xs">
                Deleting your account erases your training data and sign-in credentials for good.
              </p>
              {authError && <p className="text-destructive mt-1 text-xs">{authError}</p>}
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={removeAccount}
                className="text-destructive hover:text-destructive mt-2"
              >
                {busy === 'delete' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete account
              </Button>
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
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4" /> Export JSON
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
              onClick={() => {
                if (confirm('Erase all your SmartFit data? This cannot be undone.'))
                  void clearData();
              }}
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
