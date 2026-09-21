'use client';

import { useState } from 'react';
import { Download, Search, Users, ArrowRight } from 'lucide-react';
import { isAtRisk, MEMBER_STATUSES, type GymMembership } from '@smartfit/core';
import { useTenant, formatMoney } from '@/lib/tenant-context';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

export function MemberDirectory() {
  const t = useTenant();
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const now = Date.now();
  const roster = t.roster.filter((m) => m.role === 'member');
  const rows = roster
    .filter(
      (m) =>
        `${m.displayName ?? ''} ${m.email ?? ''} ${m.phone ?? ''} ${m.uid}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (segment === 'all' ||
          (segment === 'at-risk'
            ? isAtRisk(m, now)
            : segment === 'renewing'
              ? m.status === 'active' &&
                !!m.expiresAt &&
                m.expiresAt >= now &&
                m.expiresAt <= now + 7 * 86400000
              : m.status === segment)),
    )
    .sort((a, b) => b.joinedAt - a.joinedAt);
  const member = t.roster.find((m) => m.uid === selected);
  const exportRows = () =>
    downloadCsv(
      `${t.slug}-members.csv`,
      toCsv(rows, [
        { header: 'Member', value: (m) => m.displayName },
        { header: 'UID', value: (m) => m.uid },
        { header: 'Email', value: (m) => m.email },
        { header: 'Phone', value: (m) => m.phone },
        { header: 'Status', value: (m) => m.status },
        { header: 'Plan', value: (m) => m.planId },
        { header: 'Check-ins', value: (m) => m.checkins },
        { header: 'Joined (UTC)', value: (m) => new Date(m.joinedAt).toISOString() },
        {
          header: 'Expiry (UTC)',
          value: (m) => (m.expiresAt ? new Date(m.expiresAt).toISOString() : ''),
        },
      ]),
    );
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Member directory</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Find a member, follow up, or keep renewals on track.
          </p>
        </div>
        <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
          <Download /> Export filtered roster
        </Button>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Total members', roster.length],
          ['At risk', roster.filter((m) => isAtRisk(m, now)).length],
          ['Active', roster.filter((m) => m.status === 'active').length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{label}</p>
              <strong className="mt-2 block text-2xl">{value}</strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
          <Input
            aria-label="Search members"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, phone or member ID…"
          />
        </div>
        <Select
          aria-label="Member segment"
          className="w-auto"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
        >
          <option value="all">All members</option>
          <option value="at-risk">At risk · no recent visit</option>
          <option value="renewing">Renewing in 7 days</option>
          {MEMBER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <Card>
        <CardContent className="p-3 sm:p-5">
          {rows.length === 0 && (
            <div className="text-muted-foreground py-10 text-center">
              <Users className="mx-auto mb-2 size-7" />
              <p>No members match this view.</p>
            </div>
          )}
          {rows.map((m) => (
            <button
              type="button"
              key={m.uid}
              className="hover:bg-secondary flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border-b p-3 text-left last:border-0"
              onClick={() => setSelected(m.uid)}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-full font-bold">
                  {(m.displayName ?? m.uid).slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{m.displayName ?? m.uid}</span>
                  <span className="text-muted-foreground block text-xs">
                    {m.checkins} check-ins ·{' '}
                    {m.lastVisitAt
                      ? `last seen ${new Date(m.lastVisitAt).toLocaleDateString('en-GB')}`
                      : 'no visits yet'}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                {isAtRisk(m, now) && (
                  <Badge variant="outline" className="text-amber-600">
                    At risk
                  </Badge>
                )}
                <Badge variant="secondary">{m.status}</Badge>
                <ArrowRight className="size-4" />
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        {rows.length} of {roster.length} members · newest first. Exports contain personal data;
        share only with authorized staff.
      </p>
      <Dialog
        open={!!member}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>{member && <MemberDetail key={member.uid} member={member} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function MemberDetail({ member: m }: { member: GymMembership }) {
  const t = useTenant();
  const toast = useToast();
  const [notes, setNotes] = useState(m.notes ?? '');
  const busy = t.mutating !== null || t.viewAs;
  const plan = t.plans.find((p) => p.id === m.planId);
  async function action(run: () => Promise<boolean>, message: string) {
    if (await run()) toast(message, 'success');
    else toast('Could not save. Check the console error and retry.', 'info');
  }
  return (
    <>
      <DialogTitle>{m.displayName ?? 'Member profile'}</DialogTitle>
      <DialogDescription>
        {m.uid} · {m.status}
      </DialogDescription>
      <div className="space-y-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">Contact</p>
            <p className="break-all">{m.email || 'No email'}</p>
            <p>{m.phone || 'No phone'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Membership</p>
            <p>{plan?.name ?? m.planId ?? 'No plan assigned'}</p>
            <p>
              {m.expiresAt
                ? `Expires ${new Date(m.expiresAt).toLocaleDateString('en-GB')}`
                : 'No expiry set'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Joined</p>
            {new Date(m.joinedAt).toLocaleDateString('en-GB')}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Visits</p>
            {m.checkins} check-ins
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.can('checkin:door') && (
            <Button
              disabled={busy}
              onClick={() => action(() => t.checkInMember(m.uid), 'Member checked in')}
            >
              Check in
            </Button>
          )}
          {t.can('member:status:change') &&
            (m.status === 'active' || m.status === 'trial' || m.status === 'frozen') && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  action(
                    () => t.setMemberStatus(m.uid, m.status === 'frozen' ? 'active' : 'frozen'),
                    'Member status updated',
                  )
                }
              >
                {m.status === 'frozen' ? 'Reactivate membership' : 'Freeze membership'}
              </Button>
            )}
        </div>
        <div>
          <label htmlFor="member-notes" className="text-sm font-semibold">
            Internal notes
          </label>
          <p className="text-muted-foreground mb-2 text-xs">
            For gym operators. Never displayed in the member’s interface.
          </p>
          <textarea
            id="member-notes"
            rows={4}
            className="bg-background w-full rounded-xl border p-3 text-sm"
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy || !t.can('member:status:change')}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{notes.length} / 2000</span>
            <Button
              size="sm"
              disabled={busy || !t.can('member:status:change') || notes === (m.notes ?? '')}
              onClick={() => action(() => t.updateMemberNotes(m.uid, notes), 'Notes saved')}
            >
              Save notes
            </Button>
          </div>
        </div>
        {t.can('revenue:read') && (
          <div>
            <p className="mb-2 text-sm font-semibold">Recent invoices</p>
            {t.invoices
              .filter((i) => i.memberUid === m.uid)
              .sort((a, b) => b.issuedAt - a.issuedAt)
              .slice(0, 5)
              .map((i) => (
                <div key={i.id} className="flex items-center justify-between border-b py-2 text-sm">
                  <span>
                    {new Date(i.issuedAt).toLocaleDateString('en-GB')} · {i.status}
                  </span>
                  <strong>{formatMoney(i.amountMinor, i.currency)}</strong>
                </div>
              ))}
            {!t.invoices.some((i) => i.memberUid === m.uid) && (
              <p className="text-muted-foreground text-xs">No invoices for this member.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
