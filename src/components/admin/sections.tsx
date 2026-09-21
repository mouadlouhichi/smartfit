'use client';

/**
 * Platform-admin console sections.
 *
 * One file for the same reason the tenant console is one file: these sections
 * share the vocabulary (a Metric, a status tone, a money formatter) and are
 * never routed to directly — the pages under `/admin/**` are thin wrappers.
 *
 * The tone follows the rest of the app: destructive actions confirm inline,
 * refusals explain themselves, and money is always labelled with its unit.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Eye,
  ExternalLink,
  PlayCircle,
  Plus,
  Search,
} from 'lucide-react';
import {
  isGymLive,
  isValidSlug,
  LIVE_GYM_STATUSES,
  slugify,
  type GymStatus,
  type TenantPlan,
} from '@smartfit/core';
import { formatMoney } from '@/lib/tenant-metrics';
import { useAdmin } from '@/lib/admin-context';
import type { AdminApplication, AdminAuditEntry, PlatformInvoice } from '@/lib/admin-model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// ── Shared bits ──────────────────────────────────────────────────────────────

export function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warn' | 'good';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p
          className={cn(
            'mt-1 text-3xl font-black tracking-tight tabular-nums',
            tone === 'warn' && 'text-amber-500',
            tone === 'good' && 'text-emerald-500',
          )}
        >
          {value}
        </p>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function statusTone(status: GymStatus | string): string {
  switch (status) {
    case 'active':
    case 'paid':
      return 'bg-emerald-500/15 text-emerald-600';
    case 'trial':
      return 'bg-sky-500/15 text-sky-600';
    case 'past_due':
      return 'bg-amber-500/15 text-amber-600';
    case 'pending':
      return 'bg-slate-500/15 text-slate-500';
    case 'suspended':
    case 'closed':
    case 'rejected':
      return 'bg-red-500/15 text-red-500';
    default:
      return 'bg-slate-500/15 text-slate-500';
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusTone(status)} variant="secondary">
      {status.replace('_', ' ')}
    </Badge>
  );
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SectionError() {
  const { error, reload, diagnostics } = useAdmin();
  if (!error) return null;
  return (
    <Card className="border-red-500/40">
      <CardContent className="text-sm">
        <p className="font-semibold text-red-600">Could not load platform data</p>
        <p className="text-muted-foreground mt-1">{error}</p>
        {diagnostics && diagnostics.length > 0 && (
          <pre className="bg-muted mt-3 overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {diagnostics.join('\n')}
          </pre>
        )}
        <Button size="sm" variant="outline" className="mt-3" onClick={reload}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

export function OverviewSection() {
  const { overview, data } = useAdmin();
  const pending = data.applications.filter((a) => a.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Live gyms"
          value={String(overview.liveGyms)}
          hint={`${overview.totalGyms} provisioned`}
        />
        <Metric
          label="Platform MRR"
          value={formatMoney(overview.platformMrrMinor)}
          tone="good"
          hint="Active + past-due tenants"
        />
        <Metric
          label="Members across gyms"
          value={String(overview.membersTotal)}
          hint={`${overview.staffTotal} staff`}
        />
        <Metric
          label="Collected (30d)"
          value={formatMoney(overview.collected30dMinor)}
          hint="Recorded subscription payments"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="New this month" value={String(overview.newThisMonth)} />
        <Metric
          label="Suspended / closed"
          value={String(overview.byStatus.suspended + overview.byStatus.closed)}
          tone={overview.byStatus.suspended > 0 ? 'warn' : 'default'}
        />
        <Metric
          label="Applications waiting"
          value={String(overview.pendingApplications)}
          tone={overview.pendingApplications > 0 ? 'warn' : 'default'}
        />
        <Metric label="Classes published" value={String(overview.classesTotal)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tenants by status</CardTitle>
            <CardDescription>The funnel the platform actually steers by.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {LIVE_GYM_STATUSES.concat(['pending', 'suspended', 'closed'] as GymStatus[]).map(
              (status) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={status} />
                  </span>
                  <span className="tabular-nums">{overview.byStatus[status] ?? 0}</span>
                </div>
              ),
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MRR by plan</CardTitle>
            <CardDescription>
              Trials are not revenue — they have not bought anything yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {Object.entries(overview.mrrByPlan).length === 0 && (
              <p className="text-muted-foreground text-sm">No paying tenants yet.</p>
            )}
            {Object.entries(overview.mrrByPlan).map(([planId, minor]) => (
              <div key={planId} className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{planId}</span>
                <span className="tabular-nums">{formatMoney(minor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" /> Applications waiting for review
            </CardTitle>
            <CardDescription>
              Every day of delay is a gym choosing a paper notebook instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {pending.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"
              >
                <span className="font-medium">{a.gymName}</span>
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  {a.city ?? '—'} · {fmtDate(a.createdAt)}
                </span>
              </div>
            ))}
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link href="/admin/applications">
                Review applications <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * "Set up a gym" — provision a tenant directly from the console.
 *
 * The application queue is for gyms that come to the platform; this is for
 * gyms the platform brings itself (a pilot, a partner, a gym whose paper
 * application arrived by phone). Same provisioning as an approval: trial
 * status, chosen plan, owner resolved from their email when the account
 * exists — and the address is claimed up front so nobody prints a URL that
 * later turns out to be taken.
 */
function SetupGymCard() {
  const admin = useAdmin();
  const { data, mutating } = admin;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [accentColor, setAccentColor] = useState('');

  /** Follows the name until the operator edits it by hand. */
  const address = (slugTouched ? slug : slugify(name)).toLowerCase();
  const plan = planId || data.plans[0]?.id || 'starter';
  const ready = name.trim().length >= 2 && mutating === null;

  async function submit() {
    const chosen = address.trim();
    if (chosen && !isValidSlug(chosen)) {
      toast(`"${chosen}" cannot be a gym address (reserved words and punctuation).`, 'info');
      return;
    }
    const res = await admin.createGym({
      name: name.trim(),
      ...(chosen ? { slug: chosen } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(ownerEmail.trim() ? { ownerEmail: ownerEmail.trim() } : {}),
      planId: plan,
      ...(accentColor.trim() ? { accentColor: accentColor.trim() } : {}),
    });
    if (res.ok) {
      toast(`${name.trim()} set up at ${res.slug}.smartfit`, 'success');
      if (res.note) toast(res.note, 'info');
      setOpen(false);
      setName('');
      setSlug('');
      setSlugTouched(false);
      setCity('');
      setOwnerEmail('');
      setAccentColor('');
    } else {
      toast(admin.mutationError ?? 'Provisioning failed', 'info');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">Set up a gym</p>
            <p className="text-muted-foreground text-xs">
              Provision a tenant directly — trial status, chosen plan, optional owner. For gyms the
              platform brings itself; applicants still go through the queue.
            </p>
          </div>
          <Button
            size="sm"
            variant={open ? 'outline' : 'default'}
            className="rounded-full"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'Close' : <Plus className="size-4" />} {open ? '' : 'Set up a gym'}
          </Button>
        </div>

        {open && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="new-gym-name" label="Gym name" className="sm:col-span-2">
              <Input
                id="new-gym-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Atlas Strength Club"
                maxLength={60}
              />
            </Field>
            <Field
              id="new-gym-slug"
              label="Address (slug)"
              hint="Left empty: derived from the name."
            >
              <Input
                id="new-gym-slug"
                value={address}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="atlas-strength"
                maxLength={40}
              />
            </Field>
            <Field id="new-gym-city" label="City">
              <Input
                id="new-gym-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Casablanca"
                maxLength={60}
              />
            </Field>
            <Field
              id="new-gym-owner"
              label="Owner email — optional"
              hint="An existing account becomes the owner; otherwise assign one later."
            >
              <Input
                id="new-gym-owner"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@gym.com"
              />
            </Field>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Field id="new-gym-plan" label="Platform plan">
                <Select id="new-gym-plan" value={plan} onChange={(e) => setPlanId(e.target.value)}>
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.monthlyPriceMinor, p.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="new-gym-accent" label="Accent">
                <Input
                  id="new-gym-accent"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#8ad200"
                  maxLength={7}
                  className="w-24"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button size="sm" className="rounded-full" disabled={!ready} onClick={submit}>
                <Plus className="size-4" /> Provision gym
              </Button>
              <p className="text-muted-foreground text-xs">
                Lands as {address ? `${address}.smartfit` : 'a derived address'} on the{' '}
                <span className="font-semibold">{plan}</span> plan, trial status.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RegistrySection() {
  const { data } = useAdmin();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.gyms
      .filter((g) => (status === 'all' ? true : g.status === status))
      .filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.slug.includes(q) ||
          (g.city ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.memberCount - a.memberCount);
  }, [data.gyms, query, status]);

  return (
    <div className="space-y-4">
      <SetupGymCard />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, address, city…"
            aria-label="Search gyms"
            className="pl-9"
          />
        </div>
        <Field id="reg-status" label="Status" className="w-40">
          <Select id="reg-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {['pending', 'trial', 'active', 'past_due', 'suspended', 'closed'].map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card>
        <CardContent className="space-y-1">
          {rows.length === 0 && <p className="text-muted-foreground p-2 text-sm">No gyms match.</p>}
          {rows.map((gym) => (
            <Link
              key={gym.slug}
              href={`/admin/gyms/${gym.slug}`}
              className="border-border/60 hover:bg-secondary/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border-b p-2.5 text-sm last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: gym.accentColor || '#8ad200' }}
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{gym.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {gym.slug}.smartfit · {gym.city ?? '—'}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground hidden tabular-nums sm:inline">
                  {gym.memberCount} members · {gym.classCount} classes
                </span>
                {gym.contract === 'overdue' && (
                  <Badge className="bg-red-500/15 text-red-500" variant="secondary">
                    overdue
                  </Badge>
                )}
                <StatusBadge status={gym.status} />
                <span className="hidden font-medium tabular-nums md:inline">
                  {gym.tenantPlanId}
                </span>
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Gym detail ───────────────────────────────────────────────────────────────

export function GymDetailSection({ slug }: { slug: string }) {
  const admin = useAdmin();
  const { data, mutating, mutationError } = admin;
  const toast = useToast();
  const gym = data.gyms.find((g) => g.slug === slug);
  const [planId, setPlanId] = useState('');
  const [ownerUid, setOwnerUid] = useState('');

  const plan = data.plans.find((p) => p.id === gym?.tenantPlanId);
  const invoices = data.invoices.filter((i) => i.slug === slug).slice(0, 6);

  if (!gym) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-sm">
          No gym exists at “{slug}”.{' '}
          <Link className="underline underline-offset-4" href="/admin/gyms">
            Back to the registry
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  async function act(fn: () => Promise<boolean>, message: string) {
    const ok = await fn();
    if (ok) toast(message, 'success');
    else toast(admin.mutationError ?? 'The action failed', 'info');
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-4 rounded-full"
              style={{ backgroundColor: gym.accentColor || '#8ad200' }}
            />
            <h2 className="text-2xl font-black tracking-tight">{gym.name}</h2>
            <StatusBadge status={gym.status} />
          </div>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-mono">{gym.slug}</span>
            <span>· owner {gym.ownerName ?? (gym.ownerUid || 'unassigned')}</span>
            <span>· joined {fmtDate(gym.createdAt)}</span>
            {isGymLive(gym.status) && (
              <a
                href={`/g/${gym.slug}`}
                className="hover:text-foreground inline-flex items-center gap-1 underline underline-offset-4"
              >
                storefront <ExternalLink className="size-3" />
              </a>
            )}
          </p>
          {gym.contract && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Contract:</span>
              <StatusBadge status={gym.contract === 'current' ? 'active' : gym.contract} />
              <span className="text-muted-foreground text-xs">
                {gym.lastPaymentAt
                  ? `last payment ${fmtDate(gym.lastPaymentAt)}`
                  : 'no payment recorded yet'}
                {gym.contract === 'overdue' && ' — consider suspending until it settles'}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/g/${gym.slug}/console?viewAs=1`}>
              <Eye className="size-3.5" /> View as gym
            </Link>
          </Button>
        </div>
      </header>

      {mutationError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {mutationError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Members" value={String(gym.memberCount)} hint={`${gym.staffCount} staff`} />
        <Metric label="Classes" value={String(gym.classCount)} />
        <Metric
          label="Platform plan"
          value={plan?.name ?? gym.tenantPlanId}
          hint={
            plan ? formatMoney(plan.monthlyPriceMinor, plan.currency) + ' / month' : 'Unknown plan'
          }
        />
        <Metric
          label="Member revenue"
          value={formatMoney(gym.memberRevenueMinor)}
          hint="The gym's own money, all time"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lifecycle</CardTitle>
            <CardDescription>
              Suspending locks the gym out without deleting a byte — the reversible kill switch.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {gym.status !== 'suspended' && (
              <Button
                size="sm"
                variant="outline"
                disabled={mutating !== null}
                onClick={() =>
                  act(() => admin.setGymStatus(slug, 'suspend'), `${gym.name} suspended`)
                }
              >
                <Ban className="size-3.5" /> Suspend
              </Button>
            )}
            {(gym.status === 'suspended' || gym.status === 'closed') && (
              <Button
                size="sm"
                variant="outline"
                disabled={mutating !== null}
                onClick={() =>
                  act(() => admin.setGymStatus(slug, 'restore'), `${gym.name} restored`)
                }
              >
                <PlayCircle className="size-3.5" /> Restore
              </Button>
            )}
            {gym.status !== 'closed' && (
              <Button
                size="sm"
                variant="outline"
                disabled={mutating !== null}
                onClick={() => act(() => admin.setGymStatus(slug, 'close'), `${gym.name} closed`)}
              >
                Close permanently
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan & owner</CardTitle>
            <CardDescription>
              Hard limits are what the tiers enforce, not suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <Field id="gym-plan" label="Platform plan" className="flex-1">
                <Select
                  id="gym-plan"
                  value={planId || gym.tenantPlanId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.monthlyPriceMinor, p.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                size="sm"
                disabled={mutating !== null || !planId || planId === gym.tenantPlanId}
                onClick={() =>
                  act(() => admin.setGymPlan(slug, planId), `${gym.name} moved to ${planId}`)
                }
              >
                Change
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <Field id="gym-owner" label="Assign owner (uid or email)" className="flex-1">
                <Input
                  id="gym-owner"
                  value={ownerUid}
                  onChange={(e) => setOwnerUid(e.target.value)}
                  placeholder={gym.ownerUid || 'uid or email of the new owner'}
                />
              </Field>
              <Button
                size="sm"
                disabled={mutating !== null || !ownerUid.trim()}
                onClick={() =>
                  act(() => admin.assignOwner(slug, ownerUid.trim()), 'Owner assigned')
                }
              >
                Assign
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {invoices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscription payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {invoices.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{i.method}</Badge>
                  <span className="text-muted-foreground text-xs">{fmtDateTime(i.paidAt)}</span>
                </span>
                <span className="tabular-nums">{formatMoney(i.amountMinor, i.currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Applications ─────────────────────────────────────────────────────────────

function ApplicationCard({ app }: { app: AdminApplication }) {
  const admin = useAdmin();
  const toast = useToast();
  const [slug, setSlug] = useState(app.slug ?? '');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const busy = admin.mutating !== null;
  const pending = app.status === 'pending';

  async function decide(decision: 'approve' | 'reject') {
    const result = await admin.decideApplication(app.id, decision, {
      ...(slug ? { slug } : {}),
      ...(reason ? { reason } : {}),
    });
    if (!result.ok) {
      toast(admin.mutationError ?? 'The decision failed', 'info');
      return;
    }
    if (decision === 'approve') {
      toast(`Provisioned ${result.slug ?? app.slug}`, 'success');
      if (result.note) setNote(result.note);
    } else {
      toast('Application rejected', 'success');
    }
  }

  return (
    <Card className={pending ? 'border-amber-500/30' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{app.gymName}</span>
          <StatusBadge status={app.status} />
        </CardTitle>
        <CardDescription>
          {[app.city, app.email, app.instagram].filter(Boolean).join(' · ')} · applied{' '}
          {fmtDate(app.createdAt)}
        </CardDescription>
      </CardHeader>
      {app.message && (
        <CardContent className="pb-0">
          <p className="text-muted-foreground text-sm italic">“{app.message}”</p>
        </CardContent>
      )}
      {app.status === 'rejected' && app.reason && (
        <CardContent className="pb-0">
          <p className="text-sm text-red-600">Rejected: {app.reason}</p>
        </CardContent>
      )}
      {app.status === 'approved' && (
        <CardContent className="pb-0">
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" /> Provisioned as{' '}
            <Link
              className="underline underline-offset-4"
              href={`/admin/gyms/${app.provisionedSlug}`}
            >
              {app.provisionedSlug}
            </Link>
          </p>
        </CardContent>
      )}
      {note && (
        <CardContent className="pb-0">
          <p className="text-sm text-amber-600">{note}</p>
        </CardContent>
      )}
      {pending && (
        <CardContent className="space-y-3">
          <Field id={`slug-${app.id}`} label="Address (optional override)">
            <Input
              id={`slug-${app.id}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={app.slug ?? 'suggested from the gym name'}
            />
          </Field>
          <Field id={`reason-${app.id}`} label="Rejection reason (required to reject)">
            <Input
              id={`reason-${app.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this is a no, in the applicant's words"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide('approve')}>
              Approve & provision
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !reason.trim()}
              onClick={() => decide('reject')}
            >
              Reject
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ApplicationsSection() {
  const { data } = useAdmin();
  const pending = data.applications.filter((a) => a.status === 'pending');
  const decided = data.applications.filter((a) => a.status !== 'pending');

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Waiting for review</h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-sm">
              The queue is empty. New applications arrive from the “List your gym” form on the
              public directory.
            </CardContent>
          </Card>
        ) : (
          pending.map((a) => <ApplicationCard key={a.id} app={a} />)
        )}
      </div>
      {decided.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Decided</h2>
          {decided.map((a) => (
            <ApplicationCard key={a.id} app={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Plans & limits ───────────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: TenantPlan }) {
  const admin = useAdmin();
  const toast = useToast();
  const [price, setPrice] = useState<string>(String(plan.monthlyPriceMinor / 100));
  const [members, setMembers] = useState(String(plan.limits.members));
  const [staffSeats, setStaffSeats] = useState(String(plan.limits.staffSeats));
  const [classesPerWeek, setClassesPerWeek] = useState(String(plan.limits.classesPerWeek));
  const [customBranding, setCustomBranding] = useState(plan.limits.customBranding);

  const dirty =
    Math.round(Number(price) * 100) !== plan.monthlyPriceMinor ||
    Number(members) !== plan.limits.members ||
    Number(staffSeats) !== plan.limits.staffSeats ||
    Number(classesPerWeek) !== plan.limits.classesPerWeek ||
    customBranding !== plan.limits.customBranding;

  async function save() {
    const ok = await admin.savePlan(plan.id, {
      monthlyPriceMinor: Math.round(Number(price) * 100),
      limits: {
        members: Number(members),
        staffSeats: Number(staffSeats),
        classesPerWeek: Number(classesPerWeek),
        customBranding,
      },
    });
    if (ok) toast(`${plan.name} updated`, 'success');
    else toast(admin.mutationError ?? 'Could not update the plan', 'info');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{plan.name}</CardTitle>
        <CardDescription>
          {formatMoney(plan.monthlyPriceMinor, plan.currency)} / month · {plan.limits.locations}{' '}
          location
          {plan.limits.locations === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field id={`${plan.id}-price`} label="Price / month">
            <Input
              id={`${plan.id}-price`}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field id={`${plan.id}-members`} label="Member cap">
            <Input
              id={`${plan.id}-members`}
              type="number"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
          </Field>
          <Field id={`${plan.id}-staff`} label="Staff seats">
            <Input
              id={`${plan.id}-staff`}
              type="number"
              value={staffSeats}
              onChange={(e) => setStaffSeats(e.target.value)}
            />
          </Field>
          <Field id={`${plan.id}-classes`} label="Classes / week">
            <Input
              id={`${plan.id}-classes`}
              type="number"
              value={classesPerWeek}
              onChange={(e) => setClassesPerWeek(e.target.value)}
            />
          </Field>
        </div>
        <label
          className="flex items-center justify-between gap-3 text-sm"
          htmlFor={`${plan.id}-branding`}
        >
          <span>Custom branding</span>
          <input
            id={`${plan.id}-branding`}
            type="checkbox"
            className="size-4"
            checked={customBranding}
            onChange={(e) => setCustomBranding(e.target.checked)}
          />
        </label>
        <Button size="sm" onClick={save} disabled={!dirty || admin.mutating !== null}>
          Save {plan.name}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PlansSection() {
  const { data } = useAdmin();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-2xl text-sm">
        These tiers are the platform&apos;s brakes: a gym over its member cap cannot enrol more, and
        branding is an entitlement, not a default. Changes apply to every tenant on the tier,
        including existing ones.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {data.plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
    </div>
  );
}

// ── Revenue ──────────────────────────────────────────────────────────────────

export function RevenueSection() {
  const admin = useAdmin();
  const { data, overview } = admin;
  const toast = useToast();
  const [slug, setSlug] = useState('');
  const [method, setMethod] = useState<PlatformInvoice['method']>('transfer');
  const [note, setNote] = useState('');

  const perGym = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of data.invoices) map.set(i.slug, (map.get(i.slug) ?? 0) + i.amountMinor);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.invoices]);

  async function record() {
    const ok = await admin.recordPayment(slug, { method, ...(note ? { note } : {}) });
    if (ok) {
      toast('Payment recorded', 'success');
      setSlug('');
      setNote('');
    } else {
      toast(admin.mutationError ?? 'Could not record the payment', 'info');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Platform MRR" value={formatMoney(overview.platformMrrMinor)} tone="good" />
        <Metric label="Collected (30d)" value={formatMoney(overview.collected30dMinor)} />
        <Metric
          label="Recorded all time"
          value={formatMoney(data.invoices.reduce((s, i) => s + i.amountMinor, 0))}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Record a payment</CardTitle>
          <CardDescription>
            Transfer and cash are the local norm — the platform&apos;s books are kept by recording
            what actually arrived, not by hoping a webhook fires.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field id="pay-gym" label="Gym">
              <Select id="pay-gym" value={slug} onChange={(e) => setSlug(e.target.value)}>
                <option value="">Choose…</option>
                {data.gyms.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name} — {g.tenantPlanId}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="pay-method" label="Method">
              <Select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PlatformInvoice['method'])}
              >
                <option value="transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="cmi">CMI</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field id="pay-note" label="Note (optional)">
              <Input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Q3 quarterly"
              />
            </Field>
          </div>
          <Button size="sm" onClick={record} disabled={!slug || admin.mutating !== null}>
            Record plan payment
          </Button>
          <p className="text-muted-foreground text-xs">
            Defaults to the gym&apos;s current plan price; the amount is editable server-side when
            it must differ.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By gym</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {perGym.length === 0 && (
              <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
            )}
            {perGym.map(([gymSlug, minor]) => (
              <div
                key={gymSlug}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"
              >
                <Link className="hover:underline" href={`/admin/gyms/${gymSlug}`}>
                  {data.gyms.find((g) => g.slug === gymSlug)?.name ?? gymSlug}
                </Link>
                <span className="tabular-nums">{formatMoney(minor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.invoices.slice(0, 10).map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{i.method}</Badge>
                  <span className="text-muted-foreground text-xs">{fmtDateTime(i.paidAt)}</span>
                </span>
                <span className="tabular-nums">{formatMoney(i.amountMinor, i.currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Audit ────────────────────────────────────────────────────────────────────

export function AuditSection() {
  const { data } = useAdmin();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-2xl text-sm">
        Every platform action lands here — lifecycle changes, provisioning, role grants, view-as
        sessions, recorded payments. The trail is append-only: entries cannot be edited or deleted
        from any client, including this one.
      </p>
      <Card>
        <CardContent className="space-y-1">
          {data.audit.length === 0 && (
            <p className="text-muted-foreground p-2 text-sm">Nothing has been audited yet.</p>
          )}
          {data.audit.map((entry: AdminAuditEntry) => (
            <div
              key={entry.id}
              className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
            >
              <span className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {entry.action}
                </Badge>
                <span className="font-mono text-xs">{entry.target}</span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {entry.actorUid} · {fmtDateTime(entry.at)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
