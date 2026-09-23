'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CloudUpload,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { Button } from '@/components/ui/button';

/**
 * Cloud-sync feedback.
 *
 * Writes used to be fire-and-forget: a failed save looked identical to a
 * successful one until you reloaded on another device and found the workout
 * missing. The store now queues writes and reports their health here.
 */
export function SyncBanner() {
  const { cloud, syncStatus, syncError, retrySync } = useStore();

  if (!cloud || syncStatus !== 'error') return null;

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 sm:mx-6 lg:mx-8"
    >
      <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Changes aren&apos;t syncing.</span>{' '}
        <span className="text-muted-foreground">
          {syncError ?? 'We couldn’t reach the server.'} Your data is safe on this device.
        </span>
      </p>
      <Button size="sm" variant="outline" onClick={retrySync} className="rounded-full">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

/**
 * Offered the first time someone signs in to an empty cloud account while
 * on-device data exists. Without this the local history simply vanished
 * behind the new empty account.
 */
export function MigrationPrompt() {
  const { pendingMigration, importLocalData, discardLocalData } = useStore();
  const [busy, setBusy] = useState(false);

  if (!pendingMigration) return null;

  const { counts } = pendingMigration;
  const parts = [
    counts.sessions && `${counts.sessions} workout${counts.sessions === 1 ? '' : 's'}`,
    counts.schedule && `${counts.schedule} scheduled session${counts.schedule === 1 ? '' : 's'}`,
    counts.goals && `${counts.goals} goal${counts.goals === 1 ? '' : 's'}`,
    counts.bodyLogs && `${counts.bodyLogs} measurement${counts.bodyLogs === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[];

  async function run() {
    setBusy(true);
    try {
      await importLocalData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-primary/30 bg-primary/10 mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 sm:mx-6 lg:mx-8">
      <CloudUpload className="text-primary h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Bring your existing training with you?</span>{' '}
        <span className="text-muted-foreground">
          We found {parts.join(', ')} saved on this device. Your new account is empty.
        </span>
      </p>
      <span className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={discardLocalData} disabled={busy}>
          Start fresh
        </Button>
        <Button size="sm" onClick={run} disabled={busy} className="rounded-full">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </span>
    </div>
  );
}

/**
 * The browser refused to persist the on-device mirror (localStorage quota
 * exceeded or storage disabled). The session keeps working in memory, but
 * offline resilience is gone — the user deserves to know, once, with the
 * escape hatch that actually helps (exporting a backup).
 */
export function StorageWarningBanner() {
  const { storageFull, dismissStorageWarning } = useStore();

  if (!storageFull) return null;

  return (
    <div
      role="alert"
      className="border-border bg-secondary/70 mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 sm:mx-6 lg:mx-8"
    >
      <HardDrive className="text-muted-foreground h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">This device is out of storage for SmartFit.</span>{' '}
        <span className="text-muted-foreground">
          Everything still works, but new changes may not survive a reload. Export a backup from
          Profile, then free up browser storage.
        </span>
      </p>
      <Button size="sm" variant="ghost" onClick={dismissStorageWarning}>
        Dismiss
      </Button>
    </div>
  );
}

/**
 * Told when a slice of the account could not be read at all.
 *
 * The account loaded, so this is not the failure screen — but a collection the
 * deployed rules refuse shows up later as "my check-ins are gone", which reads
 * as data loss. Naming the collection and the fix turns that into a one-line
 * deploy instead of a mystery. Dismissible, because the rest of the app works.
 */
export function BlockedDataBanner() {
  const { cloud, blockedNotice, blockedCollections, dismissBlockedNotice } = useStore();

  if (!cloud || blockedCollections.length === 0 || !blockedNotice) return null;

  return (
    <div
      role="status"
      className="border-border bg-secondary/70 mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 sm:mx-6 lg:mx-8"
    >
      <ShieldAlert className="text-muted-foreground h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Some of your data is blocked.</span>{' '}
        <span className="text-muted-foreground">{blockedNotice}</span>
      </p>
      <Button size="sm" variant="ghost" onClick={dismissBlockedNotice}>
        Dismiss
      </Button>
    </div>
  );
}
