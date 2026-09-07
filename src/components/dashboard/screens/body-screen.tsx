'use client';

import { useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Pencil, Plus, Ruler, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { BODY_UNIT_META } from '@smartfit/core';
import {
  bodyDisplayUnit,
  bodyLabel,
  bodyValueToDisplay,
  formatDateLabel,
  round,
} from '@smartfit/core';
import type { BodyUnit } from '@smartfit/core';

export function BodyScreen() {
  const { state } = useStore();
  const { openModal, openWith } = useModals();

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
            <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
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
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className="text-primary h-4 w-4" /> {meta?.label ?? activeUnit} trend
              </CardTitle>
              <Select
                id="body-measurement"
                aria-label="Choose which measurement to chart"
                value={activeUnit}
                onChange={(e) => setUnit(e.target.value as BodyUnit)}
                className="h-9 w-40"
              >
                {unitsWithData.map((u) => (
                  <option key={u} value={u}>
                    {BODY_UNIT_META[u]?.label ?? u}
                  </option>
                ))}
              </Select>
            </CardHeader>
            <CardContent>
              {delta != null && (
                <div className="mb-3 flex items-center gap-2 text-sm">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                      trendDown ? 'bg-primary/10 text-primary' : 'bg-chart-3/10 text-chart-3'
                    }`}
                  >
                    {trendDown ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                    {Math.abs(delta)} {displayUnit}
                  </span>
                  <span className="text-muted-foreground">since your first log</span>
                </div>
              )}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
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
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--chart-2)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--chart-2)' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[...state.bodyLogs]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((l) => {
                  return (
                    <button
                      key={l.id}
                      onClick={() => openWith({ kind: 'body', log: l })}
                      className="border-border hover:border-primary/50 hover:bg-secondary/40 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                    >
                      <span className="bg-secondary text-muted-foreground flex h-9 w-9 items-center justify-center rounded-lg">
                        <Ruler className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{bodyLabel(l.unit, l.label)}</p>
                        <p className="text-muted-foreground text-xs">{formatDateLabel(l.date)}</p>
                      </div>
                      <span className="text-sm font-semibold">
                        {round(bodyValueToDisplay(l.value, l.unit, state.profile), 1)}{' '}
                        {bodyDisplayUnit(l.unit, state.profile)}
                      </span>
                      <Pencil className="text-muted-foreground h-4 w-4" />
                    </button>
                  );
                })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
