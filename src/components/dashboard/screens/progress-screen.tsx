'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart3, PieChart } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INTENSITY_META } from '@/lib/constants';
import { categoryBreakdown, weeklySeries } from '@/lib/fitness';
import { formatMinutes } from '@/lib/format';

export function ProgressScreen() {
  const { state } = useStore();
  const series = useMemo(() => weeklySeries(state, 8), [state]);
  const breakdown = useMemo(() => categoryBreakdown(state), [state]);

  const intensityData = useMemo(() => {
    const order: (keyof typeof INTENSITY_META)[] = ['low', 'moderate', 'high'];
    return order
      .map((k) => ({
        name: INTENSITY_META[k].label,
        value: state.sessions.filter((s) => s.intensity === k).length,
        color: INTENSITY_META[k].color,
      }))
      .filter((x) => x.value > 0);
  }, [state]);

  const totalMin = breakdown.reduce((a, x) => a + x.minutes, 0);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-sm text-muted-foreground">Volume and distribution across your training history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Weekly active minutes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  cursor={{ fill: 'var(--secondary)', opacity: 0.5 }}
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="minutes" fill="var(--chart-1)" radius={[6, 6, 0, 0]} name="Minutes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-primary" /> Time by activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Log workouts to see your mix.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={breakdown.map((b) => ({ name: b.category.name, value: b.minutes, color: b.category.color }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {breakdown.map((b) => (
                        <Cell key={b.category.id} fill={b.category.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number, name: string) => [formatMinutes(v), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </RPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Intensity spread
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {intensityData.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            {intensityData.map((d) => {
              const total = intensityData.reduce((a, x) => a + x.value, 0);
              return (
                <div key={d.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{d.name} intensity</span>
                    <span className="text-muted-foreground">
                      {d.value} sessions · {Math.round((d.value / total) * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
                    />
                  </div>
                </div>
              );
            })}
            {totalMin > 0 && (
              <p className="pt-2 text-xs text-muted-foreground">
                {formatMinutes(totalMin)} of training tracked in total.{' '}
                <Link href="/dashboard/body" className="text-primary hover:underline">
                  See body trends →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
