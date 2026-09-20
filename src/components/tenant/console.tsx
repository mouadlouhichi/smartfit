'use client';

/**
 * Gym owner + staff console.
 *
 * One tree, two audiences, separated by capability rather than by route. The
 * nav renders only what `can(role, …)` allows, and a denied section is
 * **absent** rather than disabled — a receptionist who can see a greyed-out
 * "Revenue" tab has learned something they should not have.
 *
 * The UI check is convenience only. Firestore rules are the real boundary, so a
 * hand-crafted request still fails even if this file were bypassed entirely.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  TicketCheck,
  Banknote,
  Layers,
  UserCog,
  Settings as SettingsIcon,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  AT_RISK_DAYS,
  isAtRisk,
  roleLabel,
  type Capability,
  type GymMembership,
} from '@smartfit/core';
import { formatMoney, useTenant } from '@/lib/tenant-context';
import type { GymBooking, GymSlot } from '@/lib/firebase/tenant-repo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ── Nav ──────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Capability required to see this section at all. */
  capability: Capability;
}

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, capability: 'reports:gym' },
  { id: 'today', label: 'Today', icon: TicketCheck, capability: 'checkin:door' },
  { id: 'timetable', label: 'Timetable', icon: CalendarDays, capability: 'class:create' },
  { id: 'members', label: 'Members', icon: Users, capability: 'member:roster:read' },
  { id: 'revenue', label: 'Revenue', icon: Banknote, capability: 'revenue:read' },
  { id: 'plans', label: 'Plans', icon: Layers, capability: 'plan:manage' },
  { id: 'staff', label: 'Staff', icon: UserCog, capability: 'staff:invite' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, capability: 'branding:edit' },
];

function Metric({
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

function statusTone(status: GymMembership['status']) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/15 text-emerald-600';
    case 'trial':
      return 'bg-sky-500/15 text-sky-600';
    case 'frozen':
      return 'bg-slate-500/15 text-slate-500';
    case 'expired':
      return 'bg-red-500/15 text-red-500';
    default:
      return 'bg-amber-500/15 text-amber-600';
  }
}

// ── Sections ─────────────────────────────────────────────────────────────────

function Overview() {
  const t = useTenant();
  const m = t.metrics;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Active members"
          value={String(m.activeMembers)}
          hint={`${t.roster.length} total on the roster`}
        />
        <Metric
          label="MRR"
          value={formatMoney(m.mrrMinor)}
          hint="From active memberships, normalised to monthly"
          tone="good"
        />
        <Metric
          label="Collected (30d)"
          value={formatMoney(m.collectedMinor)}
          hint="Paid invoices"
        />
        <Metric
          label="Occupancy"
          value={`${m.occupancyPct}%`}
          hint={`${m.seatsBooked} of ${m.seatCapacity} seats booked`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="At risk"
          value={String(m.atRisk)}
          hint={`No visit in ${AT_RISK_DAYS}+ days`}
          tone={m.atRisk > 0 ? 'warn' : 'default'}
        />
        <Metric
          label="Expiring in 7 days"
          value={String(m.expiringSoon)}
          tone={m.expiringSoon > 0 ? 'warn' : 'default'}
        />
        <Metric label="Frozen" value={String(m.frozen)} />
      </div>

      {m.atRisk > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" /> Win-back worklist
            </CardTitle>
            <CardDescription>
              Members who have stopped coming. A message now is cheaper than replacing them later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.roster
              .filter((r) => r.role === 'member' && isAtRisk(r, Date.now()))
              .map((r) => {
                const days = Math.floor((Date.now() - (r.lastVisitAt ?? 0)) / 86_400_000);
                return (
                  <div
                    key={r.uid}
                    className="border-border/60 flex items-center justify-between border-b pb-2 text-sm last:border-0"
                  >
                    <span className="font-medium">{r.displayName ?? r.uid}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      last seen {days}d ago · {r.checkins} visits
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function seatLabel(slot: GymSlot) {
  const left = Math.max(0, slot.capacity - slot.booked);
  return left === 0 ? 'Full' : `${left} left`;
}

function Today() {
  const t = useTenant();
  const todays = useMemo(() => {
    // Computed inside the memo: a `Date` built in the render body would be a new
    // object every render and defeat the memo entirely.
    const now = Date.now();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return t.slots
      .filter(
        (s) => !s.cancelled && s.startsAt >= now - 86_400_000 && s.startsAt <= endOfToday.getTime(),
      )
      .sort((a, b) => a.startsAt - b.startsAt);
  }, [t.slots]);
  const classById = useMemo(() => new Map(t.classes.map((c) => [c.id, c])), [t.classes]);
  const bookingsBySlot = useMemo(() => {
    const map = new Map<string, GymBooking[]>();
    for (const b of t.bookings) {
      const list = map.get(b.slotId) ?? [];
      list.push(b);
      map.set(b.slotId, list);
    }
    return map;
  }, [t.bookings]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Front desk</CardTitle>
          <CardDescription>
            Search a member, mark them in, book them into a class. Nothing here changes pricing or
            deletes anyone — that is the owner&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Check-in writes to the roster; booking runs a transaction so two people cannot take the
            last seat at once.
          </p>
        </CardContent>
      </Card>

      {todays.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">No classes today.</CardContent>
        </Card>
      ) : (
        todays.map((slot) => {
          const cls = classById.get(slot.classId);
          const seated = (bookingsBySlot.get(slot.id) ?? []).filter((b) => b.status === 'booked');
          return (
            <Card key={slot.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{cls?.name ?? 'Class'}</span>
                  <Badge variant="secondary">
                    {new Date(slot.startsAt).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {cls?.studio} · {cls?.instructorName} · {seated.length}/{slot.capacity} booked
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {seated.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nobody booked yet.</p>
                ) : (
                  seated.map((b) => (
                    <div
                      key={b.id}
                      className="border-border/60 flex items-center justify-between border-b py-1.5 text-sm last:border-0"
                    >
                      <span>{b.memberName ?? b.uid}</span>
                      <Badge variant="outline">{b.status}</Badge>
                    </div>
                  ))
                )}
                <p className="text-muted-foreground pt-2 text-xs tabular-nums">
                  {seatLabel(slot)} · {cls?.minutes} min
                </p>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Timetable() {
  const t = useTenant();
  const classById = useMemo(() => new Map(t.classes.map((c) => [c.id, c])), [t.classes]);
  const slots = useMemo(() => [...t.slots].sort((a, b) => a.startsAt - b.startsAt), [t.slots]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {t.classes.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>
                {c.focus} · {c.intensity} · {c.minutes} min · cap {c.capacity}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {c.studio && <p>{c.studio}</p>}
              {c.instructorName && <p>{c.instructorName}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scheduled occurrences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {slots.map((s) => (
            <div
              key={s.id}
              className="border-border/60 flex items-center justify-between border-b py-1.5 text-sm last:border-0"
            >
              <span>{classById.get(s.classId)?.name ?? s.classId}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {new Date(s.startsAt).toLocaleString('en-GB', {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {s.booked}/{s.capacity}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Members() {
  const t = useTenant();
  const now = Date.now();
  const members = useMemo(
    () => t.roster.filter((r) => r.role === 'member').sort((a, b) => b.joinedAt - a.joinedAt),
    [t.roster],
  );
  const canEdit = t.can('member:status:change');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Roster</CardTitle>
        <CardDescription>
          {members.length} members. A member who has not been seen in {AT_RISK_DAYS} days is
          flagged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {members.map((m) => {
          const risk = isAtRisk(m, now);
          const daysLeft =
            typeof m.expiresAt === 'number' ? Math.ceil((m.expiresAt - now) / 86_400_000) : null;
          return (
            <div
              key={m.uid}
              className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {m.displayName ?? m.uid}
                  {risk && (
                    <Badge className="bg-amber-500/15 text-amber-600" variant="secondary">
                      at risk
                    </Badge>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  joined {new Date(m.joinedAt).toLocaleDateString('en-GB')} · {m.checkins} check-ins
                  {typeof m.lastVisitAt === 'number' &&
                    ` · last ${Math.floor((now - m.lastVisitAt) / 86_400_000)}d ago`}
                </p>
                {m.notes && (
                  <p className="text-muted-foreground mt-0.5 text-xs italic">{m.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {daysLeft !== null && m.status === 'active' && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {daysLeft >= 0 ? `${daysLeft}d left` : 'lapsed'}
                  </span>
                )}
                <Badge className={statusTone(m.status)} variant="secondary">
                  {m.status}
                </Badge>
                {canEdit && (
                  <Button size="sm" variant="outline">
                    {m.status === 'frozen' ? 'Activate' : 'Freeze'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Revenue() {
  const t = useTenant();
  const invoices = useMemo(
    () => [...t.invoices].sort((a, b) => b.issuedAt - a.issuedAt),
    [t.invoices],
  );
  const paid = invoices.filter((i) => i.status === 'paid');
  const total = paid.reduce((s, i) => s + i.amountMinor, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="MRR" value={formatMoney(t.metrics.mrrMinor)} tone="good" />
        <Metric label="Collected (30d)" value={formatMoney(t.metrics.collectedMinor)} />
        <Metric
          label="Invoiced (all time)"
          value={formatMoney(total)}
          hint={`${paid.length} paid invoices`}
        />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {invoices.map((i) => (
            <div
              key={i.id}
              className="border-border/60 flex items-center justify-between border-b py-1.5 text-sm last:border-0"
            >
              <span>{t.roster.find((r) => r.uid === i.memberUid)?.displayName ?? i.memberUid}</span>
              <span className="flex items-center gap-2">
                <Badge variant="outline">{i.method ?? 'other'}</Badge>
                <Badge
                  className={statusTone(i.status === 'paid' ? 'active' : 'expired')}
                  variant="secondary"
                >
                  {i.status}
                </Badge>
                <span className="w-28 text-right tabular-nums">
                  {formatMoney(i.amountMinor, i.currency)}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Plans() {
  const t = useTenant();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {t.plans.map((p) => (
        <Card key={p.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{p.name}</CardTitle>
            <CardDescription className="capitalize">per {p.period}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-black tabular-nums">
              {formatMoney(p.priceMinor, p.currency)}
            </p>
            {p.description && <p className="text-muted-foreground text-xs">{p.description}</p>}
            <Badge variant={p.published === false ? 'outline' : 'secondary'}>
              {p.published === false ? 'unpublished' : 'published'}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Staff() {
  const t = useTenant();
  const staff = t.roster.filter((r) => r.role === 'owner' || r.role === 'staff');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Team</CardTitle>
        <CardDescription>
          Roles come from the membership document the security rules read — not from a claim, so
          adding staff takes effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {staff.map((s) => (
          <div
            key={s.uid}
            className="border-border/60 flex items-center justify-between border-b py-2 last:border-0"
          >
            <span className="font-medium">{s.displayName ?? s.uid}</span>
            <Badge variant="secondary">{s.role}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsSection() {
  const t = useTenant();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gym settings</CardTitle>
        <CardDescription>
          Status, slug and owner are not editable here — the rules reject an owner changing them.
          Those are platform-admin actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Slug / subdomain: </span>
          <code className="font-mono">{t.slug}</code>
        </p>
        <p>
          <span className="text-muted-foreground">Status: </span>
          {t.gym?.status ?? '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Platform plan: </span>
          {t.gym?.tenantPlanId ?? '—'}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

export function Console() {
  const t = useTenant();
  const [tab, setTab] = useState<string | null>(null);

  const visible = useMemo(() => SECTIONS.filter((s) => t.can(s.capability)), [t]);

  // Staff land on Today; the owner lands on Overview. Computed rather than
  // hard-coded so it follows whatever the capability filter leaves.
  useEffect(() => {
    if (tab === null && visible.length > 0) setTab(visible[0].id);
  }, [tab, visible]);

  // Keep the selected tab valid if the role changes underneath it.
  useEffect(() => {
    if (tab && !visible.some((s) => s.id === tab)) setTab(visible[0]?.id ?? null);
  }, [tab, visible]);

  if (t.loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6">
        <div className="bg-muted h-8 w-48 animate-pulse rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-bold">You have no console access to this gym</p>
        <p className="text-muted-foreground mt-2 text-sm">
          You are signed in as a member. Ask the gym owner to add you as staff if you should have
          access.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <a href={`/g/${t.slug}`}>Back to {t.gym?.name ?? 'the gym'}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t.gym?.name ?? t.slug}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{roleLabel(t.role)}</Badge>
            <a
              href={`/g/${t.slug}`}
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              storefront <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {t.mode === 'demo' && (
            <div className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border border-dashed p-1.5">
              <span className="text-muted-foreground px-1 text-xs">Demo role</span>
              <select
                aria-label="Demo role"
                className="bg-background rounded-md border px-2 py-1 text-xs"
                value={t.demoRole ?? 'gym-owner'}
                onChange={(e) => t.setDemoRole(e.target.value as typeof t.role)}
              >
                <option value="gym-owner">Gym owner</option>
                <option value="gym-staff">Gym staff</option>
                <option value="member">Member</option>
                <option value="platform-admin">Platform admin</option>
              </select>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={t.reload}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </header>

      {t.mode === 'demo' && (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-xl border border-dashed p-3 text-xs">
          Demo data — no Firebase project is configured. The role switcher above only changes what
          this UI renders; in cloud mode the ID-token claim and the membership document are the sole
          inputs.
        </div>
      )}

      <Tabs value={tab ?? undefined} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {visible.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              <s.icon className="mr-1.5 size-3.5" />
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Overview />
        </TabsContent>
        <TabsContent value="today" className="mt-4">
          <Today />
        </TabsContent>
        <TabsContent value="timetable" className="mt-4">
          <Timetable />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <Members />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <Revenue />
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <Plans />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <Staff />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
