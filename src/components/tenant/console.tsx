'use client';
import { GymLogo } from './brand-media';
import { TeamManager as Staff } from './team-manager';

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
 * After every write the provider refetches, so what is on screen is what the
 * server accepted — not an optimistic guess that the rules may have rejected.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Dumbbell,
  ShieldCheck,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  LayoutDashboard,
  Layers,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  TicketCheck,
  UserCog,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  isGymCustomer,
  AT_RISK_DAYS,
  isAtRisk,
  roleLabel,
  type Capability,
  type GymMembership,
} from '@smartfit/core';
import { formatMoney, useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/firebase/auth-context';
import type { GymBooking, GymClass, GymSlot } from '@/lib/firebase/tenant-repo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { MemberDirectory } from './member-directory';
import { ProfileStudio } from './profile-studio';
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
  { id: 'staff', label: 'Team', icon: UserCog, capability: 'staff:invite' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, capability: 'branding:edit' },
];

const FOCUS_OPTIONS = ['combat', 'hiit', 'strength', 'cardio', 'mind', 'aqua'] as const;

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

/** Badge colour for a membership/invoice/booking status. Shared with the member view. */
export function statusTone(status: GymMembership['status'] | string) {
  switch (status) {
    case 'active':
    case 'paid':
      return 'bg-emerald-500/15 text-emerald-600';
    case 'trial':
      return 'bg-sky-500/15 text-sky-600';
    case 'frozen':
      return 'bg-slate-500/15 text-slate-500';
    case 'expired':
    case 'overdue':
    case 'void':
      return 'bg-red-500/15 text-red-500';
    default:
      return 'bg-amber-500/15 text-amber-600';
  }
}

/** Local time → the next epoch ms on that weekday. */
function nextOccurrence(weekday: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d.getTime();
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
          value={t.rosterStatus === 'ready' ? String(m.activeMembers) : '—'}
          hint={
            t.rosterStatus === 'ready'
              ? `${t.roster.length} people, including staff`
              : 'Roster not yet verified'
          }
        />
        <Metric
          label="MRR"
          value={t.rosterStatus === 'ready' ? formatMoney(m.mrrMinor) : '—'}
          hint="Active memberships, normalised"
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
          hint={`${m.seatsBooked} of ${m.seatCapacity} seats`}
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

function Today() {
  const t = useTenant();
  const toast = useToast();

  const todays = useMemo(() => {
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

  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return t.roster
      .filter(
        (r) =>
          (r.displayName ?? r.uid).toLowerCase().includes(q) || r.uid.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, t.roster]);

  const canMark = t.can('class:attend:mark');
  const canPromote = t.can('waitlist:promote');

  async function onCheckIn(uid: string, name: string) {
    const ok = await t.checkInMember(uid);
    if (ok) {
      toast(`${name} checked in`, 'success');
      setQuery('');
    } else {
      toast(t.mutationError ?? 'Check-in failed', 'info');
    }
  }

  async function onMark(b: GymBooking, status: 'attended' | 'no_show') {
    const ok = await t.markBookingAttendance(b.id, status);
    if (ok) {
      const name = b.memberName ?? b.uid;
      toast(status === 'attended' ? `${name} attended` : `${name} marked as no-show`, 'success');
    } else {
      toast(t.mutationError ?? 'Could not mark attendance', 'info');
    }
  }

  async function onPromote(b: GymBooking) {
    const ok = await t.promoteWaitlist(b.id);
    if (ok) toast(`${b.memberName ?? b.uid} promoted from the waitlist`, 'success');
    else toast(t.mutationError ?? 'Could not promote', 'info');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Front desk check-in</CardTitle>
          <CardDescription>
            Search by name, mark them in. This writes to the roster; nothing here changes pricing or
            deletes anyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a member…"
            aria-label="Search a member"
          />
          {matches.length > 0 && (
            <ul className="space-y-1">
              {matches.map((m) => (
                <li
                  key={m.uid}
                  className="border-border/60 flex items-center justify-between border-b py-1.5 text-sm last:border-0"
                >
                  <span>
                    {m.displayName ?? m.uid}
                    <span className="text-muted-foreground ml-2 text-xs">{m.status}</span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => onCheckIn(m.uid, m.displayName ?? m.uid)}
                    disabled={t.mutating === `checkin:${m.uid}`}
                  >
                    Check in
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {todays.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">No classes today.</CardContent>
        </Card>
      ) : (
        todays.map((slot) => {
          const cls = classById.get(slot.classId);
          const all = (bookingsBySlot.get(slot.id) ?? []).filter((b) => b.status !== 'cancelled');
          const seated = all.filter((b) => b.status === 'booked' || b.status === 'attended');
          const waitlist = all.filter((b) => b.status === 'waitlist');
          const left = Math.max(0, slot.capacity - slot.booked);
          return (
            <Card key={slot.id} data-slot-id={slot.id}>
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
                  {waitlist.length > 0 && ` · ${waitlist.length} waiting`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {all.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nobody booked yet.</p>
                ) : (
                  all.map((b) => (
                    <div
                      key={b.id}
                      className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0"
                    >
                      <span>{b.memberName ?? b.uid}</span>
                      <span className="flex items-center gap-1.5">
                        <Badge variant="outline">{b.status.replace('_', ' ')}</Badge>
                        {b.status === 'booked' && canMark && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMark(b, 'attended')}
                              disabled={t.mutating !== null}
                            >
                              Attended
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMark(b, 'no_show')}
                              disabled={t.mutating !== null}
                            >
                              No-show
                            </Button>
                          </>
                        )}
                        {b.status === 'waitlist' && canPromote && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPromote(b)}
                            disabled={t.mutating !== null || left === 0}
                            title={left === 0 ? 'The class is full' : 'Take the next seat'}
                          >
                            Promote
                          </Button>
                        )}
                      </span>
                    </div>
                  ))
                )}
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
  const toast = useToast();
  const classById = useMemo(() => new Map(t.classes.map((c) => [c.id, c])), [t.classes]);
  const slots = useMemo(() => [...t.slots].sort((a, b) => a.startsAt - b.startsAt), [t.slots]);

  const [name, setName] = useState('');
  const [focus, setFocus] = useState<(typeof FOCUS_OPTIONS)[number]>('strength');
  const [minutes, setMinutes] = useState('45');
  const [capacity, setCapacity] = useState('16');

  const [slotClassId, setSlotClassId] = useState('');
  const [weekday, setWeekday] = useState('1');
  const [time, setTime] = useState('18:00');

  async function addClass() {
    if (!name.trim()) return;
    const cls: GymClass = {
      id: `cls-${Date.now().toString(36)}`,
      name: name.trim(),
      focus,
      intensity: 'moderate',
      minutes: Number(minutes) || 45,
      capacity: Number(capacity) || 16,
      createdAt: Date.now(),
    };
    const ok = await t.upsertClass(cls);
    if (ok) {
      toast(`Added ${cls.name}`, 'success');
      setName('');
    } else {
      toast(t.mutationError ?? 'Could not add the class', 'info');
    }
  }

  async function addSlot() {
    const cls = classById.get(slotClassId);
    if (!cls) return;
    const startsAt = nextOccurrence(Number(weekday), time);
    const slot: GymSlot = {
      id: `slot-${Date.now().toString(36)}`,
      classId: cls.id,
      startsAt,
      endsAt: startsAt + cls.minutes * 60_000,
      capacity: cls.capacity,
      booked: 0,
      cancelled: false,
    };
    const ok = await t.upsertSlot(slot);
    if (ok) toast(`Scheduled ${cls.name}`, 'success');
    else toast(t.mutationError ?? 'Could not schedule the class', 'info');
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field id="cls-name" label="Name">
              <Input
                id="cls-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Boxing Fundamentals"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field id="cls-focus" label="Focus">
                <Select
                  id="cls-focus"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value as typeof focus)}
                >
                  {FOCUS_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="cls-min" label="Minutes">
                <Input
                  id="cls-min"
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </Field>
              <Field id="cls-cap" label="Capacity">
                <Input
                  id="cls-cap"
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </Field>
            </div>
            <Button onClick={addClass} disabled={!name.trim() || t.mutating !== null}>
              <Plus className="size-4" /> Add class
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Schedule an occurrence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field id="slot-class" label="Class">
              <Select
                id="slot-class"
                value={slotClassId}
                onChange={(e) => setSlotClassId(e.target.value)}
              >
                <option value="">Choose…</option>
                {t.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field id="slot-day" label="Weekday">
                <Select id="slot-day" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <option key={d} value={String(i)}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="slot-time" label="Start">
                <Input
                  id="slot-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
            </div>
            <Button onClick={addSlot} disabled={!slotClassId || t.mutating !== null}>
              <Plus className="size-4" /> Schedule
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scheduled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {slots.length === 0 && (
            <p className="text-muted-foreground text-sm">Nothing scheduled yet.</p>
          )}
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

function Revenue() {
  const t = useTenant();
  const toast = useToast();
  const invoices = useMemo(
    () => [...t.invoices].sort((a, b) => b.issuedAt - a.issuedAt),
    [t.invoices],
  );
  const paid = invoices.filter((i) => i.status === 'paid');
  const total = paid.reduce((s, i) => s + i.amountMinor, 0);
  /** Online plan requests waiting for the desk — the collection queue. */
  const drafts = invoices.filter((i) => i.status === 'draft');

  const canIssue = t.can('invoice:issue');
  const [memberUid, setMemberUid] = useState('');
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer' | 'cmi'>('cash');

  async function takePayment() {
    const plan = t.plans.find((p) => p.id === planId);
    if (!memberUid || !plan) return;
    // A desk sale now completes the membership too: plan, status and expiry
    // are applied in the same batch as the paid invoice.
    const ok = await t.takePlanPayment(memberUid, planId, method);
    if (ok) {
      toast(
        `Recorded ${formatMoney(plan.priceMinor, plan.currency)} — membership applied`,
        'success',
      );
      setMemberUid('');
      setPlanId('');
    } else {
      toast(t.mutationError ?? 'Could not record the payment', 'info');
    }
  }

  async function collect(invoiceId: string) {
    const ok = await t.collectInvoice(invoiceId, method);
    if (ok) toast('Collected — membership applied', 'success');
    else toast(t.mutationError ?? 'Could not collect', 'info');
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="MRR" value={formatMoney(t.metrics.mrrMinor)} tone="good" />
        <Metric label="Collected (30d)" value={formatMoney(t.metrics.collectedMinor)} />
        <Metric
          label="Invoiced (all time)"
          value={formatMoney(total)}
          hint={`${paid.length} paid`}
        />
      </div>

      {canIssue && drafts.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>To collect — online plan requests</span>
              <Badge className="bg-amber-500/15 text-amber-600" variant="secondary">
                {drafts.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Members who chose a plan on the site and pay at the desk. Collecting marks the invoice
              paid and applies the plan to their membership in one write.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.map((i) => {
              const plan = t.plans.find((p) => p.id === i.planId);
              return (
                <div
                  key={i.id}
                  className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
                >
                  <span>
                    <span className="font-medium">
                      {t.roster.find((r) => r.uid === i.memberUid)?.displayName ?? i.memberUid}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {plan?.name ?? i.planId} · {formatMoney(i.amountMinor, i.currency)}
                    </span>
                  </span>
                  <Button size="sm" onClick={() => collect(i.id)} disabled={t.mutating !== null}>
                    Collect ({method})
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {canIssue && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sell a plan at the desk</CardTitle>
            <CardDescription>
              Walk-in sale: issues a paid invoice and applies the plan — status, tier and expiry —
              to the member in one write.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field id="pay-member" label="Member">
                <Select
                  id="pay-member"
                  value={memberUid}
                  onChange={(e) => setMemberUid(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {t.roster
                    .filter((r) => r.role === 'member')
                    .map((r) => (
                      <option key={r.uid} value={r.uid}>
                        {r.displayName ?? r.uid}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field id="pay-plan" label="Plan">
                <Select id="pay-plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">Choose…</option>
                  {t.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.priceMinor, p.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="pay-method" label="Method">
                <Select
                  id="pay-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Bank transfer</option>
                  <option value="cmi">CMI</option>
                </Select>
              </Field>
            </div>
            <Button onClick={takePayment} disabled={!memberUid || !planId || t.mutating !== null}>
              Record payment
            </Button>
          </CardContent>
        </Card>
      )}

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
                <Badge variant="outline">{i.method ?? 'pending'}</Badge>
                <Badge className={statusTone(i.status)} variant="secondary">
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
  const toast = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('390');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'pass'>('month');

  async function addPlan() {
    if (!name.trim()) return;
    const ok = await t.upsertPlan({
      id: `plan-${Date.now().toString(36)}`,
      name: name.trim(),
      priceMinor: Math.round(Number(price) * 100) || 0,
      currency: 'MAD',
      period,
      published: true,
    });
    if (ok) {
      toast(`Added ${name.trim()}`, 'success');
      setName('');
    } else {
      toast(t.mutationError ?? 'Could not add the plan', 'info');
    }
  }

  return (
    <div className="space-y-4">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field id="plan-name" label="Name">
              <Input
                id="plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly"
              />
            </Field>
            <Field id="plan-price" label="Price (MAD)">
              <Input
                id="plan-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field id="plan-period" label="Period">
              <Select
                id="plan-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
                <option value="pass">Day pass</option>
              </Select>
            </Field>
          </div>
          <Button onClick={addPlan} disabled={!name.trim() || t.mutating !== null}>
            <Plus className="size-4" /> Add plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * View-as banner. Persistent by design: it cannot be dismissed, only exited,
 * and it says who is being impersonated. Entering a view-as session also
 * appends to the platform audit trail (best-effort — a failed audit write
 * must not break the read-only browse, but it is never silent on the server).
 */
function ViewAsBanner() {
  const t = useTenant();
  const { user } = useAuth();

  useEffect(() => {
    if (t.mode !== 'cloud' || !user) return;
    user
      .getIdToken()
      .then((token) =>
        fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ slug: t.slug }),
        }),
      )
      .catch(() => {
        /* the audit entry is best-effort; the read-only guarantee is not */
      });
  }, [t.mode, t.slug, user]);

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-300"
    >
      <span className="font-medium">
        Viewing {t.gym?.name ?? t.slug} — read-only gym workspace; changes are disabled. Your
        platform identity is unchanged.
      </span>
      <Button asChild size="sm" variant="outline">
        <a href={`/admin/gyms/${t.slug}`}>Exit view-as</a>
      </Button>
    </div>
  );
}

export function Console() {
  const t = useTenant();
  const [tab, setTab] = useState<string | null>(null);

  const [wide, setWide] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(true);
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const visible = useMemo(() => SECTIONS.filter((s) => t.can(s.capability)), [t]);

  // Staff land on Today; the owner lands on Overview. Derived from whatever the
  // capability filter leaves first, so it cannot point at a hidden section.
  useEffect(() => {
    if (tab === null && visible.length > 0) {
      const requested = new URLSearchParams(window.location.search).get('tab');
      setTab(visible.find((section) => section.id === requested)?.id ?? visible[0].id);
    }
  }, [tab, visible]);

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
          An active owner or staff membership is required. Access may have been removed, frozen or
          expired, or this gym may be unavailable. Ask the gym owner if you should have access.
          Trainers can use the coaching workspace.
        </p>
        {t.error && (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {t.error} Reconnect and reload this page to verify access.
          </p>
        )}
        <Button asChild variant="outline" className="mt-4">
          <a href={`/g/${t.slug}`}>Back to {t.gym?.name ?? 'the gym'}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-secondary/25 min-h-dvh sm:p-4 lg:p-6">
      <Tabs
        value={tab ?? undefined}
        onValueChange={setTab}
        orientation={wide ? 'vertical' : 'horizontal'}
        className="bg-background border-border/70 mx-auto grid max-w-[1540px] overflow-hidden sm:rounded-3xl sm:border lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[210px_minmax(0,1fr)]"
      >
        <aside className="bg-card flex flex-col border-b px-3 py-4 lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
          <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-xl">
              <Dumbbell className="size-4" />
            </span>
            <span className="text-xl font-black tracking-tight">
              SmartFit<span className="text-primary">.</span>
            </span>
          </Link>
          <p className="text-muted-foreground mb-3 hidden px-3 text-[10px] font-semibold tracking-[0.2em] uppercase lg:block">
            Gym workspace
          </p>
          <TabsList
            aria-label="Gym workspace sections"
            className="grid h-auto w-full grid-cols-4 gap-1 rounded-none bg-transparent p-0 lg:flex lg:flex-col lg:items-stretch lg:gap-1.5"
          >
            {visible.map((section) => (
              <TabsTrigger
                key={section.id}
                aria-label={section.label}
                disabled={!interactive}
                value={section.id}
                className="data-[state=active]:bg-primary/10 flex min-w-0 flex-col gap-1.5 rounded-xl px-1 py-2.5 text-[10px] data-[state=active]:shadow-none lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-xs"
              >
                <section.icon className="size-4 shrink-0" />
                <span>{section.label}</span>
                {section.id === 'members' && (
                  <span className="bg-secondary ml-auto hidden min-w-5 rounded-md px-1 py-0.5 text-center text-[10px] tabular-nums lg:inline-block">
                    {t.rosterStatus === 'ready' ? t.roster.filter(isGymCustomer).length : '—'}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="mt-8 hidden flex-1 flex-col justify-end lg:flex">
            <div className="bg-secondary/55 rounded-2xl p-4">
              <span className="text-primary">
                <ShieldCheck className="size-5" />
              </span>
              <p className="mt-3 text-xs font-semibold">
                {t.viewAs ? 'A safe look inside' : 'Your gym. Your community.'}
              </p>
              <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed">
                {t.viewAs
                  ? 'Browse your gym’s data without changing memberships or settings.'
                  : 'Keep your members, classes and team connected in one workspace.'}
              </p>
            </div>
            <div className="mt-5 flex min-w-0 items-center gap-2.5 border-t pt-5">
              {t.gym && <GymLogo gym={t.gym} className="size-9 rounded-xl text-xs" />}
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">{t.gym?.name ?? t.slug}</p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  {t.mode === 'demo' ? 'Demo workspace' : 'Gym management'}
                </p>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0">
          <header className="bg-card flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 lg:px-8">
            <div>
              <p className="text-muted-foreground mb-1 text-[10px]">
                Workspace <span className="mx-2 opacity-40">/</span>{' '}
                {visible.find((section) => section.id === tab)?.label ?? 'Overview'}
              </p>
              <h1 className="text-sm font-semibold tracking-tight">{t.gym?.name ?? t.slug}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground mr-1 hidden text-[11px] sm:inline">
                {roleLabel(t.role)}
              </span>
              <Button asChild size="sm" variant="ghost" className="text-xs">
                <Link href={`/g/${t.slug}`}>
                  storefront <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs">
                <Link href={`/g/${t.slug}/coaching`}>Coaching</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={t.reload}
                disabled={t.loading}
                aria-label="Refresh"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
          </header>
          <div className="space-y-5 p-4 sm:p-6 lg:p-8">
            {t.mode === 'demo' && (
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2 text-[10px]">
                <span>Demo workspace · sample data · changes last for this session only</span>
                <label className="flex items-center gap-2">
                  <span>Demo role</span>
                  <select
                    aria-label="Demo role"
                    disabled={!interactive}
                    className="bg-background rounded-lg border px-2 py-1 text-[11px]"
                    value={t.demoRole ?? 'gym-owner'}
                    onChange={(e) =>
                      t.setDemoRole(e.target.value as NonNullable<typeof t.demoRole>)
                    }
                  >
                    <option value="gym-owner">Gym owner</option>
                    <option value="gym-staff">Gym staff</option>
                    <option value="member">Member</option>
                    <option value="prospect">Prospect (not a member)</option>
                    <option value="platform-admin">Platform admin</option>
                  </select>
                </label>
              </div>
            )}
            {t.viewAs && <ViewAsBanner />}
            {t.error && (
              <div
                role="alert"
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
              >
                <p className="font-semibold">Some workspace data couldn’t be loaded</p>
                <p className="text-muted-foreground mt-1 text-xs">{t.error}</p>
                <Button className="mt-3" variant="outline" size="sm" onClick={t.reload}>
                  Retry workspace data
                </Button>
              </div>
            )}
            {t.mutationError && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600"
              >
                {t.mutationError}
              </div>
            )}
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
              <MemberDirectory />
            </TabsContent>
            <TabsContent value="revenue" className="mt-4">
              <Revenue />
            </TabsContent>
            <TabsContent value="plans" className="mt-4">
              <Plans />
            </TabsContent>
            <TabsContent value="staff" className="mt-4">
              <Staff />
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/g/${t.slug}/coaching`}>Manage trainers & coaching</Link>
              </Button>
            </TabsContent>
            <TabsContent
              forceMount
              value="settings"
              className={cn('mt-4', tab !== 'settings' && 'hidden')}
            >
              <ProfileStudio />
            </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}
