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
import { useState } from 'react';
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
} from 'lucide-react';
import { isGymLive, isValidSlug, slugify, type GymStatus, type TenantPlan } from '@smartfit/core';
import { formatMoney } from '@/lib/tenant-metrics';
import { useAdmin } from '@/lib/admin-context';
import type { AdminApplication, PlatformInvoice } from '@/lib/admin-model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { GymOperations, RevenueAnalytics } from './reports';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export function StatusBadge({ status }: { status: string }) {
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
export function SetupGymCard() {
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

// ── Gym detail ───────────────────────────────────────────────────────────────

export function GymDetailSection({ slug }: { slug: string }) {
  const admin = useAdmin();
  const { data, mutating, mutationError } = admin;
  const toast = useToast();
  const gym = data.gyms.find((g) => g.slug === slug);
  const [planId, setPlanId] = useState('');
  const [ownerUid, setOwnerUid] = useState('');
  const [pendingAction, setPendingAction] = useState<'suspend' | 'close' | null>(null);

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
                onClick={() => setPendingAction('suspend')}
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
                onClick={() => setPendingAction('close')}
              >
                Close gym
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

      <GymOperations slug={slug} />
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !mutating) setPendingAction(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {pendingAction === 'suspend' ? 'Suspend' : 'Close'} {gym.name}?
          </DialogTitle>
          <DialogDescription>
            This removes access to the live gym experience. Member history is preserved. You can
            restore this gym from its lifecycle controls.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={mutating !== null}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={mutating !== null}
              onClick={async () => {
                if (pendingAction && (await admin.setGymStatus(slug, pendingAction))) {
                  toast('Gym lifecycle updated', 'success');
                  setPendingAction(null);
                }
              }}
            >
              Confirm {pendingAction}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const rows = data.applications.filter(
    (a) =>
      (filter === 'all' || a.status === filter) &&
      `${a.gymName} ${a.email} ${a.city ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-3xl font-black">Application inbox</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Turn the next great gym into a SmartFit partner.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="h-auto flex-wrap">
            {['pending', 'approved', 'rejected', 'all'].map((status) => (
              <TabsTrigger key={status} value={status} className="capitalize">
                {status}{' '}
                <span className="ml-2 opacity-60">
                  {data.applications.filter((a) => status === 'all' || a.status === status).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          className="w-full sm:w-64"
          aria-label="Search applications"
          placeholder="Search gym, city, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-10 text-center text-sm">
            No applications in this view. New requests arrive from the public gym directory.
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {rows.map((a) => (
            <ApplicationCard key={a.id} app={a} />
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Latest {data.applications.length} applications loaded (maximum 100).
      </p>
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
          label="Loaded payments"
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
            Records one payment at the gym&apos;s current platform plan price. This does not charge
            a card.
          </p>
        </CardContent>
      </Card>

      <RevenueAnalytics />
    </div>
  );
}
