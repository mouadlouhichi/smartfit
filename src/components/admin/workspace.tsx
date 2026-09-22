'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GymCardMedia } from '@/components/tenant/brand-media';
import {
  ArrowDownUp,
  ArrowRight,
  Building2,
  CheckCheck,
  Download,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Wallet,
  Users,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { useAdmin } from '@/lib/admin-context';
import {
  collectAttention,
  monthBuckets,
  relativeTime,
  type AdminGymSummary,
} from '@/lib/admin-model';
import { formatMoney } from '@/lib/tenant-metrics';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, DonutChart, HBars } from './charts';
import { SetupGymCard, StatusBadge } from './sections';

const WIDGETS = {
  revenue: 'Collections chart',
  portfolio: 'Portfolio breakdown',
  attention: 'Needs attention',
  activity: 'Recent activity',
};
type Widget = keyof typeof WIDGETS;
const DEFAULT_WIDGETS: Widget[] = ['revenue', 'portfolio', 'attention', 'activity'];

export function OverviewWorkspace() {
  const { overview: o, data } = useAdmin();
  const [customize, setCustomize] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem('smartfit:admin:widgets:v1') ?? 'null',
      );
      if (Array.isArray(saved))
        setWidgets(
          saved.filter((v): v is Widget => typeof v === 'string' && Object.hasOwn(WIDGETS, v)),
        );
    } catch {
      /* Storage blocked: use defaults. */
    }
  }, []);
  function change(next: Widget[]) {
    setWidgets(next);
    try {
      localStorage.setItem('smartfit:admin:widgets:v1', JSON.stringify(next));
    } catch {
      /* Session-only is fine. */
    }
  }
  const buckets = monthBuckets(
    data.invoices.filter((i) => i.currency === 'MAD'),
    6,
    (i) => i.paidAt,
    (i) => i.amountMinor,
  );
  const attention = collectAttention(data.gyms, data.applications);
  const stats = [
    {
      label: 'Live gyms',
      value: String(o.liveGyms),
      detail: `${o.totalGyms} provisioned across the platform`,
      icon: Building2,
    },
    {
      label: 'Platform MRR',
      value: formatMoney(o.platformMrrMinor),
      detail: 'Current plan value · excludes trials',
      icon: Wallet,
    },
    {
      label: 'Members',
      value: o.membersTotal.toLocaleString(),
      detail: `${o.staffTotal} staff · ${o.classesTotal} classes`,
      icon: Users,
    },
    {
      label: 'Collected · 30 days',
      value: formatMoney(o.collected30dMinor),
      detail: 'Recorded subscription payments',
      icon: Activity,
    },
  ];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
            Your network, at a glance
          </p>
          <h2 className="text-3xl font-black tracking-tight">Platform overview</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Monitor growth, keep gyms moving, and know what needs you next.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCustomize(!customize)}
            aria-expanded={customize}
          >
            <SlidersHorizontal /> Customize
          </Button>
          <Button asChild>
            <Link href="/admin/gyms">
              Manage gyms <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>
      {customize && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold">Make this dashboard yours</h3>
                <p className="text-muted-foreground text-xs">
                  Widget visibility is saved in this browser, not shared with other operators.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => change(DEFAULT_WIDGETS)}>
                Reset layout
              </Button>
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(WIDGETS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={widgets.includes(key as Widget)}
                    onChange={(e) =>
                      change(
                        e.target.checked
                          ? [...widgets, key as Widget]
                          : widgets.filter((w) => w !== key),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-semibold">{s.label}</p>
                <span className="bg-primary/10 rounded-xl p-2">
                  <s.icon className="size-4" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight tabular-nums">{s.value}</p>
              <p className="text-muted-foreground mt-2 text-xs">{s.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {widgets.includes('revenue') && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Subscription collections</CardTitle>
                <CardDescription>
                  Six calendar months · MAD · recorded payments, not forecast revenue
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/revenue">
                  Open revenue <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={buckets.map((b) => ({ label: b.label, value: b.total }))}
              ariaLabel="Monthly recorded subscription collections in MAD"
              formatValue={(v) => formatMoney(v)}
            />
          </CardContent>
        </Card>
      )}
      {widgets.includes('portfolio') && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio health</CardTitle>
              <CardDescription>Current lifecycle status of every loaded gym</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                ariaLabel="Gym lifecycle distribution"
                data={Object.entries(o.byStatus).map(([label, value], i) => ({
                  label,
                  value,
                  color: ['#94a3b8', '#38bdf8', '#84cc16', '#fbbf24', '#fb7185', '#a78bfa'][i],
                }))}
                formatValue={String}
                centerLabel="gyms"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>MRR by plan</CardTitle>
              <CardDescription>
                Active and past-due subscriptions at current plan prices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HBars
                data={Object.entries(o.mrrByPlan).map(([id, value]) => ({
                  label: data.plans.find((p) => p.id === id)?.name ?? id,
                  value,
                }))}
                formatValue={(v) => formatMoney(v)}
              />
            </CardContent>
          </Card>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {widgets.includes('attention') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Needs attention <Badge variant="secondary">{attention.length}</Badge>
              </CardTitle>
              <CardDescription>A prioritized queue, not another spreadsheet.</CardDescription>
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 py-6 text-sm">
                  <CheckCheck className="text-emerald-500" /> All clear. No current follow-ups.
                </div>
              ) : (
                attention.map((a, i) => (
                  <Link
                    href={a.href}
                    key={i}
                    className="hover:bg-secondary flex items-center gap-3 rounded-xl border-b py-3 text-sm last:border-0"
                  >
                    <AlertCircle
                      className={
                        a.severity === 'high'
                          ? 'size-4 shrink-0 text-amber-500'
                          : 'text-muted-foreground size-4 shrink-0'
                      }
                    />
                    <span className="flex-1">{a.reason}</span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}
        {widgets.includes('activity') && (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Accountable actions across the network</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityFeed entries={data.audit.slice(0, 5)} />
              <Button asChild variant="ghost" size="sm" className="mt-3">
                <Link href="/admin/audit">
                  Explore audit trail <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Snapshot scope: up to 200 gyms and the latest 100 platform payments. Charts reflect loaded
        records, not a complete accounting ledger.
      </p>
    </div>
  );
}

export function ActivityFeed({
  entries,
}: {
  entries: ReturnType<typeof useAdmin>['data']['audit'];
}) {
  return (
    <div className="space-y-1">
      {entries.length === 0 && (
        <p className="text-muted-foreground py-4 text-sm">No activity recorded yet.</p>
      )}
      {entries.map((e) => (
        <div key={e.id} className="border-primary/20 relative border-l-2 py-2 pl-4">
          <span className="bg-primary absolute top-4 -left-[5px] size-2 rounded-full" />
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-sm font-semibold">
              {e.action.replaceAll(':', ' · ').replaceAll('-', ' ')}
            </p>
            <time title={new Date(e.at).toLocaleString()} className="text-muted-foreground text-xs">
              {relativeTime(e.at)}
            </time>
          </div>
          <p className="text-muted-foreground mt-1 text-xs break-all">
            {e.target} · {e.actorUid}
          </p>
        </div>
      ))}
    </div>
  );
}

export function RegistryWorkspace() {
  const { data } = useAdmin();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [sort, setSort] = useState('members');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const rows = useMemo(
    () =>
      data.gyms
        .filter(
          (g) =>
            (status === 'all' || g.status === status) &&
            (plan === 'all' || g.tenantPlanId === plan) &&
            [g.name, g.slug, g.city, g.ownerName].some((v) =>
              v?.toLowerCase().includes(query.trim().toLowerCase()),
            ),
        )
        .sort((a, b) =>
          sort === 'name'
            ? a.name.localeCompare(b.name)
            : sort === 'newest'
              ? b.createdAt - a.createdAt
              : b.memberCount - a.memberCount,
        ),
    [data.gyms, query, status, plan, sort],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * 12, current * 12);
  function exportRows() {
    downloadCsv(
      'smartfit-gyms.csv',
      toCsv(rows, [
        { header: 'Name', value: (g) => g.name },
        { header: 'Slug', value: (g) => g.slug },
        { header: 'City', value: (g) => g.city },
        { header: 'Status', value: (g) => g.status },
        { header: 'Plan', value: (g) => g.tenantPlanId },
        { header: 'Owner', value: (g) => g.ownerName || g.ownerUid },
        { header: 'Members', value: (g) => g.memberCount },
        { header: 'Classes', value: (g) => g.classCount },
        { header: 'Contract', value: (g) => g.contract },
      ]),
    );
  }
  const nameCell = (g: AdminGymSummary) => (
    <Link href={`/admin/gyms/${g.slug}`} className="group flex items-center gap-3">
      <span
        style={{
          backgroundColor: `${/^#[0-9a-f]{6}$/i.test(g.accentColor ?? '') ? g.accentColor : '#8ad200'}22`,
        }}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl font-black"
      >
        {g.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block font-bold group-hover:underline">{g.name}</span>
        <span className="text-muted-foreground block text-xs">
          {g.city || 'No city'} · /g/{g.slug}
        </span>
      </span>
    </Link>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Your gym network</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            One place for every location, owner, and subscription.
          </p>
        </div>
        <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
          <Download /> Export {rows.length} gyms
        </Button>
      </div>
      <SetupGymCard />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Input
            className="min-w-48 flex-1"
            placeholder="Search gyms, cities, owners…"
            aria-label="Search gyms"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <Select
            aria-label="Filter gym status"
            className="w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            {['pending', 'trial', 'active', 'past_due', 'suspended', 'closed'].map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter platform plan"
            className="w-auto"
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All plans</option>
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <ArrowDownUp className="text-muted-foreground size-4" />
            <Select
              aria-label="Sort gyms"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="members">Most members</option>
              <option value="name">Name A–Z</option>
              <option value="newest">Newest first</option>
            </Select>
          </div>
          <div className="flex gap-1">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Table view"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
            >
              <List />
            </Button>
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Card view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid />
            </Button>
          </div>
        </CardContent>
      </Card>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Building2 className="text-muted-foreground mx-auto mb-3 size-8" />
            <h3 className="font-bold">No gyms match</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Try another search or clear your filters.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setQuery('');
                setPlan('all');
                setStatus('all');
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <Card key={g.slug} className="group overflow-hidden transition-shadow hover:shadow-lg">
              <GymCardMedia
                gym={{ name: g.name, branding: g.branding ?? { accentColor: g.accentColor } }}
              />
              <CardContent className="space-y-4 p-5">
                {nameCell(g)}
                <div className="flex items-center justify-between">
                  <StatusBadge status={g.status} />
                  <span className="text-muted-foreground text-xs capitalize">{g.tenantPlanId}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t pt-4 text-sm">
                  <span>
                    <b className="block text-xl">{g.memberCount}</b>
                    <span className="text-muted-foreground text-xs">Members</span>
                  </span>
                  <span>
                    <b className="block text-xl">{g.classCount}</b>
                    <span className="text-muted-foreground text-xs">Classes</span>
                  </span>
                  <span>
                    <b className="block text-xl">{g.staffCount}</b>
                    <span className="text-muted-foreground text-xs">Staff</span>
                  </span>
                </div>
                <Button asChild variant="outline" className="w-full" size="sm">
                  <Link href={`/admin/gyms/${g.slug}`}>
                    Manage gym <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  {['Gym', 'Status', 'Plan', 'Members', 'Contract', 'Owner'].map((h) => (
                    <th key={h} className="px-5 py-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.slug} className="hover:bg-muted/30 border-t">
                    <td className="min-w-64 px-5 py-4">{nameCell(g)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-5 py-4 capitalize">{g.tenantPlanId}</td>
                    <td className="px-5 py-4 font-semibold tabular-nums">{g.memberCount}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={g.contract ?? 'unknown'} />
                    </td>
                    <td className="text-muted-foreground max-w-48 truncate px-5 py-4">
                      {g.ownerName || (g.ownerUid ? 'Assigned' : 'Unassigned')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="text-muted-foreground">
          {rows.length} matching · {data.gyms.length} loaded (up to 200)
        </p>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span>
            {current} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AuditWorkspace() {
  const { data } = useAdmin();
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');
  const [days, setDays] = useState('all');
  const rows = data.audit
    .filter(
      (e) =>
        (action === 'all' || e.action === action) &&
        (days === 'all' || e.at >= Date.now() - Number(days) * 86400000) &&
        `${e.action} ${e.target} ${e.actorUid}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.at - a.at);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black">Audit trail</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Who changed what, and when. Read-only by design.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(
              'smartfit-audit.csv',
              toCsv(rows, [
                { header: 'Time (UTC)', value: (e) => new Date(e.at).toISOString() },
                { header: 'Action', value: (e) => e.action },
                { header: 'Target', value: (e) => e.target },
                { header: 'Actor', value: (e) => e.actorUid },
                { header: 'Details', value: (e) => JSON.stringify(e.meta ?? {}) },
              ]),
            )
          }
        >
          <Download /> Export
        </Button>
      </header>
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Search audit trail"
          placeholder="Search target, action, or operator…"
          className="min-w-48 flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Filter audit action"
          className="w-auto"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="all">All actions</option>
          {[...new Set(data.audit.map((e) => e.action))].sort().map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter audit period"
          className="w-auto"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="all">All loaded dates</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </Select>
      </div>
      <Card>
        <CardContent className="p-5">
          {rows.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">No matching activity.</p>
          )}
          {rows.map((e) => (
            <details key={e.id} className="border-b py-3 last:border-0">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span>
                  <Badge variant="secondary">{e.action}</Badge>
                  <span className="ml-3 text-sm break-all">{e.target}</span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(e.at).toLocaleString('en-GB')} · Show details
                </span>
              </summary>
              <div className="bg-muted/50 mt-3 rounded-lg p-3 text-xs">
                <p className="break-all">Operator: {e.actorUid}</p>
                <pre className="mt-2 overflow-x-auto break-all whitespace-pre-wrap">
                  {JSON.stringify(e.meta ?? {}, null, 2)}
                </pre>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        {rows.length} matching entries · latest {data.audit.length} loaded (maximum 50).
      </p>
    </div>
  );
}
