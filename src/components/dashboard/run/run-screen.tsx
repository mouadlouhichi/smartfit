'use client';

import { useMemo, useState } from 'react';
import { Footprints, History, Trophy } from 'lucide-react';
import { RunRecord } from './run-record';
import { RunHistory } from './run-history';
import { RunRecords } from './run-records';
import { useStore } from '@/lib/store-context';
import { isTrackedRun, runTotals, fmtKm, fmtDuration, fmtPace } from '@smartfit/core';
import { cn } from '@/lib/utils';

type Tab = 'record' | 'history' | 'records';

const TABS: { id: Tab; label: string; icon: typeof Footprints }[] = [
  { id: 'record', label: 'Record', icon: Footprints },
  { id: 'history', label: 'History', icon: History },
  { id: 'records', label: 'Records', icon: Trophy },
];

/**
 * The dedicated run hub: record, history and records in one place.
 *
 * This exists as its own screen (rather than another dashboard modal) because
 * running has a different rhythm from logging a gym session — the live view
 * owns the whole viewport, the history reads like a feed, and the records tab
 * answers "am I getting faster?" without hunting through Progress.
 */
export function RunScreen() {
  const { state, ready } = useStore();
  const [tab, setTab] = useState<Tab>('record');

  const runs = useMemo(() => state.sessions.filter(isTrackedRun), [state.sessions]);
  const totals = useMemo(() => runTotals(runs), [runs]);
  const avgPace = totals.distanceKm > 0 ? totals.movingMin / totals.distanceKm : 0;

  return (
    <div className="grid max-w-full min-w-0 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-volt-ink text-[11px] font-bold tracking-[0.18em] uppercase">Cardio</p>
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">
            Run
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            GPS recording, splits, best efforts and share cards — all on this device.
          </p>
        </div>
        {runs.length > 0 && (
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Runs" value={`${totals.runs}`} />
            <Stat label="Distance" value={fmtKm(totals.distanceKm)} />
            <Stat label="Time" value={fmtDuration(Math.round(totals.movingMin * 60))} />
            <Stat label="Avg pace" value={`${fmtPace(avgPace)} /km`} />
          </dl>
        )}
      </header>

      <nav aria-label="Run sections" className="bg-secondary flex gap-1 rounded-full p-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors sm:flex-none sm:px-6',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>

      {tab === 'record' && <RunRecord onSaved={() => setTab('history')} />}
      {tab === 'history' && (
        <RunHistory sessions={state.sessions} loading={!ready} onRecord={() => setTab('record')} />
      )}
      {tab === 'records' && <RunRecords sessions={state.sessions} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-mono text-base font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}
