'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  History,
  Loader2,
  Pencil,
  Plus,
  Ruler,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { CategoryIcon } from '@/components/category-icon';
import { BODY_UNIT_META } from '@smartfit/core';
import {
  bodyDisplayUnit,
  bodyLabel,
  bodyValueToDisplay,
  formatDateLabel,
  fromKg,
  kgToTarget,
  round,
} from '@smartfit/core';
import type { BodyUnit } from '@smartfit/core';

/** Tinted tile per measurement family (all AA-contrast inks on cards). */
const UNIT_STYLE: Record<string, string> = {
  weight: 'bg-primary/10 text-primary',
  bodyfat: 'bg-chart-2/10 text-chart-2',
  waist: 'bg-chart-4/10 text-chart-4',
  chest: 'bg-chart-4/10 text-chart-4',
  arms: 'bg-clay/10 text-clay',
  custom: 'bg-clay/10 text-clay',
};

export function BodyScreen() {
  const { state, hasMoreBodyLogs, loadingMore, loadEarlierBodyLogs } = useStore();
  const { openModal, openWith } = useModals();
  const [pageError, setPageError] = useState<string | null>(null);

  async function loadMore() {
    setPageError(null);
    try {
      await loadEarlierBodyLogs();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Could not load older measurements.');
    }
  }

  const unitsWithData = useMemo(
    () => Array.from(new Set(state.bodyLogs.map((l) => l.unit))) as BodyUnit[],
    [state.bodyLogs],
  );
  const [unit, setUnit] = useState<BodyUnit>(unitsWithData[0] ?? 'weight');
  const activeUnit: BodyUnit = unitsWithData.includes(unit) ? unit : (unitsWithData[0] ?? 'weight');

  const meta = BODY_UNIT_META[activeUnit];
  // Values are stored canonically (kg / cm) and converted for display only.
  const displayUnit = bodyDisplayUnit(activeUnit, state.profile);

  const points = useMemo(
    () =>
      state.bodyLogs
        .filter((l) => l.unit === activeUnit)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((l) => ({
          date: l.date,
          label: formatDateLabel(l.date),
          value: round(bodyValueToDisplay(l.value, l.unit, state.profile), 1),
        })),
    [state.bodyLogs, activeUnit, state.profile],
  );

  const latest = points[points.length - 1]?.value;
  const first = points[0]?.value;
  const delta = latest != null && first != null ? Math.round((latest - first) * 10) / 10 : null;
  const trendDown = delta != null && delta < 0;
  // Signed gap (canonical kg) between the latest weight log and the profile
  // target — shown as a chip only while viewing the weight trend.
  const toTarget = activeUnit === 'weight' ? kgToTarget(state) : null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Body</h1>
          <p className="text-muted-foreground text-sm">
            Track weight and measurements to see real change.
          </p>
        </div>
        <Button onClick={() => openModal('body')}>
          <Plus className="h-4 w-4" /> Log measurement
        </Button>
      </div>

      {state.bodyLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-accent text-accent-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
              <Ruler className="h-7 w-7" />
            </span>
            <p className="font-semibold">No measurements yet</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              Log your body weight today. Over a few weeks the trend line tells the story a daily
              number never could.
            </p>
            <Button onClick={() => openModal('body')}>Add first measurement</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:space-y-0">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                  <CategoryIcon name={meta?.icon ?? 'ruler'} size={17} />
                </span>
                <span className="min-w-0">{meta?.label ?? activeUnit} trend</span>
              </CardTitle>
              <Select
                id="body-measurement"
                aria-label="Choose which measurement to chart"
                value={activeUnit}
                onChange={(e) => setUnit(e.target.value as BodyUnit)}
                className="w-full min-[480px]:w-40"
              >
                {unitsWithData.map((u) => (
                  <option key={u} value={u}>
                    {BODY_UNIT_META[u]?.label ?? u}
                  </option>
                ))}
              </Select>
            </CardHeader>
            <CardContent>
              {/* Hero numbers: latest value large, honest delta chip beside it */}
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-end gap-3">
                  <p className="font-display text-4xl leading-none font-extrabold tracking-tight tabular-nums sm:text-5xl">
                    {latest ?? '—'}
                    <span className="text-muted-foreground ml-1.5 text-base font-semibold">
                      {displayUnit}
                    </span>
                  </p>
                  {delta != null && delta !== 0 && (
                    <span
                      className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                        trendDown ? 'bg-primary/10 text-primary' : 'bg-clay/10 text-clay'
                      }`}
                    >
                      {trendDown ? (
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {trendDown ? '−' : '+'}
                      {Math.abs(delta)} {displayUnit}
                    </span>
                  )}
                  {toTarget != null && (
                    <span
                      className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                        toTarget <= 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      <Target className="h-3.5 w-3.5" aria-hidden />
                      {toTarget <= 0
                        ? 'Target reached'
                        : `${round(fromKg(toTarget, state.profile.weightUnit), 1)} ${displayUnit} to target`}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground grid grid-cols-2 gap-x-5 gap-y-1 text-right text-xs">
                  <span>
                    First logged <b className="text-foreground tabular-nums">{first ?? '—'}</b>
                  </span>
                  <span>
                    Entries <b className="text-foreground tabular-nums">{points.length}</b>
                  </span>
                  {points[0] && <span className="col-span-2">{points[0].label}</span>}
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bodyFade" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v} ${displayUnit}`, meta?.label ?? activeUnit]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      fill="url(#bodyFade)"
                      dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">History</CardTitle>
              <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-bold tabular-nums">
                {state.bodyLogs.length} entr{state.bodyLogs.length === 1 ? 'y' : 'ies'}
              </span>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[...state.bodyLogs]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((l) => {
                  const lMeta = BODY_UNIT_META[l.unit];
                  return (
                    <button
                      key={l.id}
                      onClick={() => openWith({ kind: 'body', log: l })}
                      className="border-border hover:border-primary/50 hover:bg-secondary/40 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${UNIT_STYLE[l.unit] ?? UNIT_STYLE.custom}`}
                      >
                        <CategoryIcon name={lMeta?.icon ?? 'ruler'} size={16} />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{bodyLabel(l.unit, l.label)}</p>
                        <p className="text-muted-foreground text-xs">{formatDateLabel(l.date)}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        {round(bodyValueToDisplay(l.value, l.unit, state.profile), 1)}{' '}
                        <span className="text-muted-foreground font-medium">
                          {bodyDisplayUnit(l.unit, state.profile)}
                        </span>
                      </span>
                      <Pencil className="text-muted-foreground h-4 w-4" />
                    </button>
                  );
                })}
              {hasMoreBodyLogs && (
                <div className="mt-1 flex flex-col items-center gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore !== null}
                    onClick={() => void loadMore()}
                    className="rounded-full"
                  >
                    {loadingMore === 'body' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <History className="h-4 w-4" />
                    )}
                    Load earlier measurements
                  </Button>
                  {pageError && <p className="text-destructive text-xs">{pageError}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
