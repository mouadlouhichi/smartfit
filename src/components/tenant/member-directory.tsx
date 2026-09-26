'use client';

import { useState } from 'react';
import {
  Download,
  Search,
  Users,
  ArrowUpRight,
  Activity,
  CalendarClock,
  HeartHandshake,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { MEMBER_STATUSES, gymStatusLabel, isGymCustomer, type GymMembership } from '@smartfit/core';
import { useTenant, formatMoney } from '@/lib/tenant-context';
import {
  directoryStats,
  directoryStatus,
  filterDirectory,
  memberAtRisk,
  renewingSoon,
  memberInitials,
  memberDate,
} from '@/lib/member-directory';
import { downloadCsv, toCsv } from '@/lib/csv';
import { useI18n } from '@/lib/i18n-context';
import { intlTag } from '@/lib/intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

const AVATAR_TONES = [
  'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200',
];
function MemberAvatar({ member, large = false }: { member: GymMembership; large?: boolean }) {
  const index =
    Array.from(member.uid).reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-2xl font-semibold',
        large ? 'size-14 text-lg' : 'size-10 text-sm',
        AVATAR_TONES[index],
      )}
    >
      {memberInitials(member.displayName ?? member.uid)}
    </span>
  );
}
function MemberStatus({ member }: { member: GymMembership }) {
  const { t: tr } = useI18n();
  const status = directoryStatus(member);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize',
        status === 'active'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : status === 'trial'
            ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
            : status === 'expired' || status === 'cancelled'
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'bg-muted text-muted-foreground',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {gymStatusLabel(status, tr)}
    </span>
  );
}
const PAGE_SIZE = 8;
export function MemberDirectory() {
  // The tenant context owns `t` in this file, so the translator is `tr`.
  const t = useTenant();
  const { t: tr, locale } = useI18n();
  const date = (at?: number) => memberDate(at, intlTag(locale));
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const now = Date.now();
  const roster = t.roster.filter(isGymCustomer);
  const stats = directoryStats(t.roster, now);
  const rows = filterDirectory(t.roster, query, segment, sort, now);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const displayed = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const member = roster.find((m) => m.uid === selected);
  const ready = t.rosterStatus === 'ready';
  const filter = (value: string) => {
    setSegment(value);
    setPage(0);
  };
  const planName = (member: GymMembership) =>
    t.plans.find((plan) => plan.id === member.planId)?.name ??
    member.planId ??
    tr('gym.directory.noPlan');
  // The CSV headers stay English on purpose: they label columns for a
  // spreadsheet and the `Status`/`Role` columns export raw ids, not copy.
  const exportRows = () =>
    downloadCsv(
      `${t.slug}-members.csv`,
      toCsv(rows, [
        { header: 'Member', value: (m) => m.displayName },
        { header: 'UID', value: (m) => m.uid },
        { header: 'Email', value: (m) => m.email },
        { header: 'Phone', value: (m) => m.phone },
        { header: 'Status', value: (m) => directoryStatus(m, now) },
        { header: 'Role', value: (m) => m.role ?? 'unclassified' },
        { header: 'Plan', value: (m) => m.planId },
        { header: 'Check-ins', value: (m) => m.checkins },
        {
          header: 'Joined (UTC)',
          value: (m) => (Number.isFinite(m.joinedAt) ? new Date(m.joinedAt).toISOString() : ''),
        },
        {
          header: 'Expiry (UTC)',
          value: (m) =>
            typeof m.expiresAt === 'number' && Number.isFinite(m.expiresAt)
              ? new Date(m.expiresAt).toISOString()
              : '',
        },
      ]),
    );
  return (
    <section className="space-y-6" aria-label={tr('gym.directory.aria')}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.2em] uppercase">
            {tr('gym.directory.eyebrow')}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {tr('gym.directory.title')}
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">{tr('gym.directory.body')}</p>
        </div>
        <Button
          onClick={exportRows}
          variant="outline"
          className="bg-card rounded-xl"
          disabled={!ready || !rows.length}
        >
          <Download className="size-4" />
          {tr('gym.directory.export')}
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: 'gym.directory.stat.total',
            value: stats.total,
            note: 'gym.directory.stat.totalNote',
            icon: Users,
            tone: 'total',
          },
          {
            label: 'gym.directory.stat.active',
            value: stats.active,
            note: 'gym.directory.stat.activeNote',
            icon: Activity,
            tone: 'active',
          },
          {
            label: 'gym.directory.stat.renewing',
            value: stats.renewing,
            note: 'gym.directory.stat.renewingNote',
            icon: CalendarClock,
            tone: 'renewing',
          },
          {
            label: 'gym.directory.stat.risk',
            value: stats.atRisk,
            note: 'gym.directory.stat.riskNote',
            icon: HeartHandshake,
            tone: 'risk',
          },
        ].map(({ label, value, note, icon: Icon, tone }) => (
          <div
            key={label}
            className={cn(
              'relative overflow-hidden rounded-2xl border p-4 sm:p-5',
              tone === 'total'
                ? 'border-zinc-800 bg-zinc-900 text-white shadow-sm'
                : 'bg-card border-border/70',
            )}
          >
            {tone === 'total' && (
              <div
                aria-hidden="true"
                className="absolute -right-8 -bottom-10 size-36 rounded-full border-[22px] border-lime-300/10"
              />
            )}
            <div className="relative flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-xs font-medium',
                  tone === 'total' ? 'text-zinc-300' : 'text-muted-foreground',
                )}
              >
                {tr(label)}
              </p>
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-xl',
                  tone === 'total'
                    ? 'bg-lime-300/15 text-lime-300'
                    : tone === 'active'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : tone === 'renewing'
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-300'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <p
              className="relative mt-4 text-4xl font-semibold tracking-tight tabular-nums"
              data-testid={`member-metric-${tone}`}
            >
              {ready ? value : '—'}
            </p>
            <p
              className={cn(
                'relative mt-2 text-[11px]',
                tone === 'total' ? 'text-zinc-400' : 'text-muted-foreground',
              )}
            >
              {ready ? tr(note) : tr('gym.directory.notVerified')}
            </p>
          </div>
        ))}
      </div>
      {t.viewAs && (
        <div className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
          <ShieldCheck className="size-4" />
          {tr('gym.directory.viewAs')}
        </div>
      )}
      {ready && stats.unclassified > 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          {tr('gym.directory.unclassified', { count: stats.unclassified })}
        </p>
      )}
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="bg-card border-border/70 min-w-0 overflow-hidden rounded-2xl border shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 pt-4">
            <div className="flex flex-wrap gap-5" aria-label={tr('gym.directory.filtersAria')}>
              {[
                ['all', 'gym.directory.segmentAll'],
                ['active', 'gym.status.active'],
                ['trial', 'gym.status.trial'],
                ['at-risk', 'gym.directory.stat.risk'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={segment === value}
                  onClick={() => filter(value)}
                  className={cn(
                    'relative flex items-center gap-2 border-b-2 px-0.5 pb-3 text-xs font-medium transition-colors',
                    segment === value
                      ? 'border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground border-transparent',
                  )}
                >
                  {tr(label)}
                  {value === 'all' && (
                    <span className="bg-secondary rounded-md px-1.5 py-0.5 text-[10px] tabular-nums">
                      {ready ? stats.total : '—'}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mb-3 flex gap-1 rounded-lg border p-0.5">
              <button
                className={cn(
                  'rounded-md p-1.5',
                  view === 'list' ? 'bg-secondary' : 'text-muted-foreground',
                )}
                aria-label={tr('gym.directory.viewTable')}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <List className="size-4" />
              </button>
              <button
                className={cn(
                  'rounded-md p-1.5',
                  view === 'grid' ? 'bg-secondary' : 'text-muted-foreground',
                )}
                aria-label={tr('gym.directory.viewGrid')}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-4 sm:px-5">
            <div className="relative min-w-40 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
              <Input
                aria-label={tr('gym.directory.searchAria')}
                className="bg-background h-10 rounded-xl pl-9"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={tr('gym.directory.searchPlaceholder')}
              />
            </div>
            <Select
              aria-label={tr('gym.directory.segmentAria')}
              className="w-auto min-w-32 rounded-xl text-xs"
              value={segment}
              onChange={(e) => filter(e.target.value)}
            >
              <option value="all">{tr('gym.directory.option.allMemberships')}</option>
              <option value="at-risk">{tr('gym.directory.stat.risk')}</option>
              <option value="renewing">{tr('gym.directory.option.renewing')}</option>
              {MEMBER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {gymStatusLabel(status, tr)}
                </option>
              ))}
              <option value="review">{tr('gym.status.review')}</option>
            </Select>
            <Select
              aria-label={tr('gym.directory.sortAria')}
              className="w-auto min-w-32 rounded-xl text-xs"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(0);
              }}
            >
              <option value="newest">{tr('gym.directory.sort.newest')}</option>
              <option value="name">{tr('gym.directory.sort.name')}</option>
              <option value="visits">{tr('gym.directory.sort.visits')}</option>
              <option value="expiry">{tr('gym.directory.sort.expiry')}</option>
            </Select>
          </div>
          {t.rosterStatus === 'error' ? (
            <div
              role="alert"
              className="m-5 rounded-xl border border-rose-500/25 bg-rose-500/5 p-6"
            >
              <h3 className="font-semibold">{tr('gym.directory.errorTitle')}</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {t.rosterError} {tr('gym.directory.errorBody')}
              </p>
              <Button onClick={t.reload} variant="outline" className="mt-4">
                <RefreshCw className="size-4" />
                {tr('gym.directory.errorRetry')}
              </Button>
            </div>
          ) : !ready ? (
            <div role="status" className="text-muted-foreground px-5 py-16 text-center text-sm">
              {tr('gym.directory.loading')}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="bg-secondary mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
                <Users className="text-muted-foreground size-6" />
              </div>
              <h3 className="font-semibold">
                {tr(roster.length ? 'gym.directory.noMatchTitle' : 'gym.directory.emptyTitle')}
              </h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
                {tr(roster.length ? 'gym.directory.noMatchBody' : 'gym.directory.emptyBody')}
              </p>
              {roster.length > 0 ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setQuery('');
                    filter('all');
                  }}
                >
                  {tr('gym.directory.clearFilters')}
                </Button>
              ) : (
                <Button asChild variant="outline" className="mt-4">
                  <a href={`/g/${t.slug}`}>
                    {tr('gym.directory.openGymPage')}
                    <ArrowUpRight className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <>
              {view === 'list' && (
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-secondary/40 text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      <tr>
                        {[
                          'gym.directory.colMember',
                          'gym.member.membership',
                          'gym.directory.colStatus',
                          'gym.member.visits',
                          'gym.directory.colRenewal',
                          '',
                        ].map((label, i) => (
                          <th scope="col" key={i} className="px-4 py-3 font-medium first:pl-5">
                            {label ? (
                              tr(label)
                            ) : (
                              <span className="sr-only">{tr('gym.directory.colProfile')}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-border/60 divide-y">
                      {displayed.map((m) => (
                        <tr key={m.uid} className="group hover:bg-secondary/35 transition-colors">
                          <th scope="row" className="max-w-64 py-4 pr-3 pl-5 font-normal">
                            <button
                              type="button"
                              onClick={() => setSelected(m.uid)}
                              className="flex max-w-full min-w-0 items-center gap-3 rounded-xl text-left"
                            >
                              <MemberAvatar member={m} />
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-semibold">
                                  {m.displayName ?? m.uid}
                                </span>
                                <span className="text-muted-foreground mt-1 block max-w-52 truncate text-[11px]">
                                  {m.email ?? tr('gym.directory.noEmailOnFile')}
                                </span>
                              </span>
                            </button>
                          </th>
                          <td className="px-4 py-4">
                            <span className="text-xs font-medium">{planName(m)}</span>
                            <span className="text-muted-foreground mt-1 block text-[10px]">
                              {m.role === 'member'
                                ? tr('gym.directory.roleMember')
                                : tr('gym.directory.roleUnclassified')}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <MemberStatus member={m} />
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm font-semibold tabular-nums">
                              {m.checkins ?? '—'}
                            </span>
                            <span className="text-muted-foreground mt-1 block text-[10px] whitespace-nowrap">
                              {m.lastVisitAt
                                ? date(m.lastVisitAt)
                                : tr('gym.directory.noVisitsYet')}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-xs whitespace-nowrap">{date(m.expiresAt)}</span>
                            {renewingSoon(m, now) && (
                              <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">
                                {tr('gym.directory.dueSoon')}
                              </span>
                            )}
                            {memberAtRisk(m, now) && (
                              <span className="text-muted-foreground mt-1 block text-[10px]">
                                {tr('gym.directory.followUp')}
                              </span>
                            )}
                          </td>
                          <td className="pr-4">
                            <button
                              onClick={() => setSelected(m.uid)}
                              className="text-muted-foreground hover:bg-secondary rounded-full p-2"
                              aria-label={tr('gym.directory.viewProfile', {
                                name: m.displayName ?? m.uid,
                              })}
                            >
                              <ArrowUpRight className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div
                className={cn(
                  'grid gap-3 p-4',
                  view === 'list' ? 'md:hidden' : 'sm:grid-cols-2 xl:grid-cols-3',
                )}
              >
                {displayed.map((m) => (
                  <button
                    key={m.uid}
                    onClick={() => setSelected(m.uid)}
                    className="hover:border-primary/40 hover:bg-secondary/30 rounded-2xl border p-4 text-left transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <MemberAvatar member={m} large />
                      <MemberStatus member={m} />
                    </div>
                    <h3 className="mt-4 truncate text-sm font-semibold">
                      {m.displayName ?? m.uid}
                    </h3>
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {m.email ?? tr('gym.directory.noEmailOnFile')}
                    </p>
                    <div className="my-4 border-t" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{planName(m)}</span>
                        <span className="text-muted-foreground mt-1 block text-[11px]">
                          {tr('gym.directory.visitsLine', {
                            count: m.checkins ?? 0,
                            date: date(m.expiresAt),
                          })}
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          <footer className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-[11px]">
            <span>
              {ready
                ? tr('gym.directory.range', {
                    from: rows.length ? currentPage * PAGE_SIZE + 1 : 0,
                    to: Math.min((currentPage + 1) * PAGE_SIZE, rows.length),
                    total: rows.length,
                  })
                : tr('gym.directory.countUnavailable')}
            </span>
            <div className="flex items-center gap-3">
              <span>{tr('gym.directory.pageOf', { page: currentPage + 1, pages: pageCount })}</span>
              <button
                aria-label={tr('gym.directory.prevPage')}
                disabled={currentPage === 0 || !ready}
                onClick={() => setPage(currentPage - 1)}
                className="hover:bg-secondary rounded-lg border p-1.5 disabled:opacity-35"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                aria-label={tr('gym.directory.nextPage')}
                disabled={currentPage >= pageCount - 1 || !ready}
                onClick={() => setPage(currentPage + 1)}
                className="hover:bg-secondary rounded-lg border p-1.5 disabled:opacity-35"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </footer>
        </div>
        <aside
          className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1"
          aria-label={tr('gym.directory.insightsAria')}
        >
          <div className="bg-card border-border/70 rounded-2xl border p-5">
            <div className="mb-5 flex items-center gap-2">
              <Activity className="text-primary size-4" />
              <h3 className="text-sm font-semibold">{tr('gym.directory.pulse')}</h3>
            </div>
            {['active', 'trial', 'frozen', 'expired', 'cancelled'].map((status) => {
              const count = roster.filter((m) => directoryStatus(m, now) === status).length;
              return (
                <div className="mt-4" key={status}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">{gymStatusLabel(status, tr)}</span>
                    <span className="font-medium tabular-nums">{ready ? count : '—'}</span>
                  </div>
                  <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        status === 'active'
                          ? 'bg-primary'
                          : status === 'trial'
                            ? 'bg-sky-400'
                            : status === 'frozen'
                              ? 'bg-violet-400'
                              : 'bg-rose-300',
                      )}
                      style={{
                        width: ready && roster.length ? `${(count / roster.length) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-muted-foreground mt-5 text-[10px] leading-relaxed">
              {tr('gym.directory.pulseNote')}
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-5 text-white">
            <div
              aria-hidden="true"
              className="absolute -top-6 -right-8 size-32 rounded-full border-[18px] border-lime-300/10"
            />
            <span className="relative inline-flex rounded-xl bg-lime-300/15 p-2 text-lime-300">
              <HeartHandshake className="size-5" />
            </span>
            <h3 className="relative mt-4 text-lg font-semibold tracking-tight">
              {tr('gym.directory.cardTitle1')}
              <br />
              {tr('gym.directory.cardTitle2')}
            </h3>
            <p className="relative mt-2 text-xs leading-relaxed text-zinc-400">
              {tr('gym.directory.cardBody')}
            </p>
            <button
              onClick={() => filter('at-risk')}
              className="relative mt-5 flex w-full items-center justify-between rounded-xl bg-lime-300 px-3 py-2.5 text-xs font-semibold text-zinc-950"
            >
              {tr('gym.directory.cardCta')}
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        </aside>
      </div>
      <p className="text-muted-foreground flex items-start gap-2 text-[10px] leading-relaxed">
        <ShieldCheck className="mt-0.5 size-3 shrink-0" />
        {tr('gym.directory.privacy')}
      </p>
      <Dialog
        open={!!member}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {member && <MemberDetail key={member.uid} member={member} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MemberDetail({ member: m }: { member: GymMembership }) {
  const t = useTenant();
  // The tenant context owns `t` here too, so the translator is `tr`.
  const { t: tr, locale } = useI18n();
  const toast = useToast();
  const date = (at?: number) => memberDate(at, intlTag(locale));
  const [notes, setNotes] = useState(m.notes ?? '');
  const busy = t.mutating !== null || t.viewAs || m.role !== 'member';
  const plan = t.plans.find((p) => p.id === m.planId);
  async function action(run: () => Promise<boolean>, message: string) {
    if (await run()) toast(message, 'success');
    else toast(tr('gym.directory.saveError'), 'info');
  }
  return (
    <>
      <div className="bg-secondary/30 -mx-6 -mt-1 mb-2 border-b px-6 pt-2 pb-5">
        <div className="flex items-center gap-4">
          <MemberAvatar member={m} large />
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1 text-[10px] tracking-widest uppercase">
              {tr('gym.directory.profile')}
            </p>
            <DialogTitle className="truncate text-xl">
              {m.displayName ?? tr('gym.directory.profile')}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs break-all">{m.uid}</DialogDescription>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <MemberStatus member={m} />
          {t.viewAs && <Badge variant="outline">{tr('gym.directory.readOnly')}</Badge>}
          {m.role !== 'member' && (
            <Badge variant="outline">{tr('gym.directory.roleUnclassified')}</Badge>
          )}
        </div>
      </div>
      <div className="space-y-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">{tr('gym.directory.contact')}</p>
            <p className="break-all">{m.email || tr('gym.directory.noEmail')}</p>
            <p>{m.phone || tr('gym.directory.noPhone')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{tr('gym.member.membership')}</p>
            <p>{plan?.name ?? m.planId ?? tr('gym.directory.noPlan')}</p>
            <p>
              {m.expiresAt
                ? tr('gym.directory.expiresOn', { date: date(m.expiresAt) })
                : tr('gym.directory.noExpiry')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{tr('gym.directory.joined')}</p>
            {date(m.joinedAt)}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{tr('gym.member.visits')}</p>
            {tr('gym.directory.checkinCount', { count: m.checkins ?? 0 })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.can('checkin:door') && (
            <Button
              disabled={busy}
              onClick={() => action(() => t.checkInMember(m.uid), tr('gym.directory.toastCheckIn'))}
            >
              {tr('gym.console.today.checkIn')}
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
                    tr('gym.directory.toastStatus'),
                  )
                }
              >
                {m.status === 'frozen'
                  ? tr('gym.directory.reactivate')
                  : tr('gym.directory.freeze')}
              </Button>
            )}
        </div>
        <div>
          <label htmlFor="member-notes" className="text-sm font-semibold">
            {tr('gym.directory.notes')}
          </label>
          <p className="text-muted-foreground mb-2 text-xs">{tr('gym.directory.notesHint')}</p>
          <textarea
            id="member-notes"
            rows={4}
            className="border-input bg-field w-full rounded-xl border p-3 text-sm"
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
              onClick={() =>
                action(() => t.updateMemberNotes(m.uid, notes), tr('gym.directory.toastNotes'))
              }
            >
              {tr('gym.directory.saveNotes')}
            </Button>
          </div>
        </div>
        {t.can('revenue:read') && (
          <div>
            <p className="mb-2 text-sm font-semibold">{tr('gym.directory.invoices')}</p>
            {t.invoices
              .filter((i) => i.memberUid === m.uid)
              .sort((a, b) => b.issuedAt - a.issuedAt)
              .slice(0, 5)
              .map((i) => (
                <div key={i.id} className="flex items-center justify-between border-b py-2 text-sm">
                  <span>
                    {date(i.issuedAt)} · {gymStatusLabel(i.status, tr)}
                  </span>
                  <strong>{formatMoney(i.amountMinor, i.currency)}</strong>
                </div>
              ))}
            {!t.invoices.some((i) => i.memberUid === m.uid) && (
              <p className="text-muted-foreground text-xs">{tr('gym.directory.noInvoices')}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
