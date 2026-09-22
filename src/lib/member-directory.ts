import { isAtRisk, isGymCustomer, MEMBER_STATUSES, type GymMembership } from '@smartfit/core';
const DAY = 86400000;
export function directoryStatus(member: GymMembership, now = Date.now()): string {
  if (!MEMBER_STATUSES.includes(member.status)) return 'review';
  if (
    ['active', 'trial'].includes(member.status) &&
    typeof member.expiresAt === 'number' &&
    member.expiresAt <= now
  )
    return 'expired';
  return member.status;
}
export function renewingSoon(member: GymMembership, now = Date.now()) {
  return (
    ['active', 'trial'].includes(directoryStatus(member, now)) &&
    typeof member.expiresAt === 'number' &&
    member.expiresAt > now &&
    member.expiresAt <= now + 7 * DAY
  );
}
export function memberAtRisk(member: GymMembership, now = Date.now()) {
  return ['active', 'trial'].includes(directoryStatus(member, now)) && isAtRisk(member, now);
}
export function directoryStats(roster: GymMembership[], now = Date.now()) {
  const members = roster.filter(isGymCustomer);
  return {
    total: members.length,
    active: members.filter((m) => ['active', 'trial'].includes(directoryStatus(m, now))).length,
    renewing: members.filter((m) => renewingSoon(m, now)).length,
    atRisk: members.filter((m) => memberAtRisk(m, now)).length,
    unclassified: members.filter((m) => m.role !== 'member').length,
  };
}
export function filterDirectory(
  roster: GymMembership[],
  query: string,
  segment: string,
  sort: string,
  now = Date.now(),
) {
  const term = query.trim().toLocaleLowerCase();
  const rows = roster
    .filter(isGymCustomer)
    .filter(
      (m) =>
        `${m.displayName ?? ''} ${m.email ?? ''} ${m.phone ?? ''} ${m.uid}`
          .toLocaleLowerCase()
          .includes(term) &&
        (segment === 'all' ||
          (segment === 'at-risk'
            ? memberAtRisk(m, now)
            : segment === 'renewing'
              ? renewingSoon(m, now)
              : directoryStatus(m, now) === segment)),
    );
  return rows.sort((a, b) =>
    sort === 'name'
      ? (a.displayName ?? a.uid).localeCompare(b.displayName ?? b.uid)
      : sort === 'visits'
        ? (b.checkins ?? 0) - (a.checkins ?? 0)
        : sort === 'expiry'
          ? (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity)
          : (b.joinedAt ?? 0) - (a.joinedAt ?? 0),
  );
}
export function memberInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join('')
      .toLocaleUpperCase() || '?'
  );
}
export function memberDate(at?: number) {
  return typeof at === 'number' && Number.isFinite(at)
    ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}
