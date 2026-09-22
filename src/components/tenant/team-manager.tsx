'use client';
import { useState } from 'react';
import {
  ASSIGNABLE_GYM_ROLES,
  TEAM_ROLE_DESCRIPTIONS,
  isActiveGymMembership,
  type AssignableGymRole,
  type GymMembership,
} from '@smartfit/core';
import { useTenant } from '@/lib/tenant-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function TeamManager() {
  const t = useTenant();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<GymMembership | null>(null);
  const [nextRole, setNextRole] = useState<AssignableGymRole>('staff');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = t.roster.filter((row) =>
    query.trim()
      ? `${row.displayName ?? ''} ${row.email ?? ''} ${row.uid}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      : row.role !== 'member',
  );
  const protectedMember = (row: GymMembership) =>
    row.role === 'owner' || row.uid === t.gym?.ownerUid || row.uid === t.viewerUid;
  const choose = (row: GymMembership) => {
    setSelected({ ...row });
    setNextRole(row.role === 'member' ? 'staff' : 'member');
    setReason('');
    setNotice('');
  };
  const submit = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setNotice('');
    try {
      if (await t.changeTeamRole(selected.uid, nextRole, selected.role, reason)) {
        setNotice(`${selected.displayName ?? selected.uid} now has ${nextRole} access.`);
        setSelected(null);
        setReason('');
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Team access</CardTitle>
          <CardDescription>
            Assign staff or trainers to this gym. Saved changes apply to subsequent requests
            immediately; connected sessions update automatically without signing out or refreshing
            their token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {t.mode === 'demo' && (
            <p className="rounded-lg border p-3 text-sm">
              Demo only: changes last for this preview session. No invitations are sent and no cloud
              audit is written.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {ASSIGNABLE_GYM_ROLES.map((role) => (
              <div key={role} className="rounded-xl border p-3">
                <h3 className="font-semibold capitalize">{role}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{TEAM_ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            Start with an existing gym member. To add someone new, ask them to sign in and join{' '}
            <a className="underline" href={`/g/${t.slug}`}>
              your gym page
            </a>
            , then activate their membership in the directory. Owner access cannot be transferred
            here.
          </p>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Find a member to add, or search your team</span>
            <input
              className="bg-background w-full rounded-lg border px-3 py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email or member ID"
            />
          </label>
          <div className="divide-y rounded-xl border">
            {rows.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                {query
                  ? 'No matching members.'
                  : 'No staff or trainers yet. Search for a member to get started.'}
              </p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.uid}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{row.displayName ?? row.uid}</p>
                    <p className="text-muted-foreground text-xs break-all">
                      {row.email ?? row.uid}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {isActiveGymMembership(row)
                        ? 'Membership active'
                        : 'Access inactive — frozen, expired or cancelled'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{row.role}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Manage ${row.displayName ?? row.uid}`}
                      disabled={protectedMember(row) || !!t.mutating || t.viewAs || saving}
                      onClick={() => choose(row)}
                    >
                      {protectedMember(row) ? 'Protected' : 'Manage access'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {notice && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              {notice}
            </p>
          )}
          {selected && (
            <form
              className="space-y-4 rounded-xl border p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <h3 className="font-semibold">
                Change access for {selected.displayName ?? selected.uid}
              </h3>
              <p className="text-muted-foreground text-sm break-all">
                {selected.email ?? selected.uid} · Current role: {selected.role}
              </p>
              <label className="block space-y-2">
                <span className="text-sm font-medium">New role</span>
                <select
                  className="bg-background w-full rounded-lg border p-2"
                  value={nextRole}
                  onChange={(e) => setNextRole(e.target.value as AssignableGymRole)}
                  disabled={saving}
                >
                  {ASSIGNABLE_GYM_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-muted-foreground text-sm">{TEAM_ROLE_DESCRIPTIONS[nextRole]}</p>
              {nextRole === 'member' && (
                <p className="text-sm">
                  This removes staff and trainer privileges. Their gym membership and personal
                  bookings remain.
                </p>
              )}
              {!isActiveGymMembership(selected) && nextRole !== 'member' && (
                <p role="alert" className="text-destructive text-sm">
                  Activate or renew this membership before granting team access.
                </p>
              )}
              <label className="block space-y-2">
                <span className="text-sm font-medium">Reason for this change</span>
                <textarea
                  className="bg-background min-h-24 w-full rounded-lg border p-3"
                  required
                  minLength={8}
                  maxLength={500}
                  value={reason}
                  disabled={saving}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="For example: joining the front-desk team"
                />
              </label>
              <p className="text-muted-foreground text-xs">
                In cloud mode, the previous role, new role, your ID, timestamp and reason are saved
                together in the gym audit trail. Remove or reassign coaching assignments before
                changing roles.
              </p>
              {t.mutationError && (
                <p role="alert" className="text-destructive text-sm">
                  {t.mutationError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    !!t.mutating ||
                    t.viewAs ||
                    reason.trim().length < 8 ||
                    nextRole === selected.role ||
                    (nextRole !== 'member' && !isActiveGymMembership(selected))
                  }
                >
                  {saving ? 'Saving access…' : `Confirm ${nextRole} access`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
