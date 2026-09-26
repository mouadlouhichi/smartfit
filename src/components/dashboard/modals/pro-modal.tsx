'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n-context';
import type { Translator } from '@smartfit/core';
import {
  Activity,
  Check,
  Crown,
  LineChart,
  ListChecks,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  SheetHandle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { BILLING_MODE, manageSubscriptionUrl, paymentLinkFor } from '@/lib/billing';
import {
  PRO_GATES,
  PRO_PLANS,
  PRO_TRIAL_MONTHS,
  formatDateLabel,
  hasProAccess,
  isPro,
  isTrialing,
  toISODate,
  trialDaysLeft,
} from '@smartfit/core';
import type { ProPlan } from '@smartfit/core';
import { ProBadge } from '../pro-badge';
import { cn } from '@/lib/utils';

const GATE_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  'trending-up': TrendingUp,
  activity: Activity,
  'line-chart': LineChart,
  'list-checks': ListChecks,
  share: Share2,
  utensils: UtensilsCrossed,
};

/**
 * SmartFit Pro preview surface (paid billing is deliberately disabled until
 * server-side entitlements exist).
 *
 * Redesigned as a genuine *premium* surface: a dark volt hero, an anchored
 * yearly plan with a savings ribbon, an honest Free-vs-Pro comparison built
 * from `PRO_GATES` (so the paywall never promises a gate that isn't enforced),
 * and a no-card 3-month free period on every upgrade. Sandbox activation
 * writes only a profile entitlement and charges nothing, so it works for
 * signed-in accounts too; only real paid checkout stays disabled until
 * server-side billing exists.
 */
export function ProModal() {
  const { t } = useI18n();
  const { state, updateProfile } = useStore();
  const { open, payload, closeModal } = useModals();
  const confirm = useConfirm();
  const toast = useToast();
  const [plan, setPlan] = useState<ProPlan>('yearly');

  const isOpen = open === 'pro' && payload?.kind === 'pro';
  const pro = hasProAccess(state);
  const paid = isPro(state);
  const trialing = isTrialing(state);
  const meta = PRO_PLANS.find((p) => p.id === plan) ?? PRO_PLANS[0];
  const paidCheckoutConfigured = paymentLinkFor(plan) !== null;

  async function checkout(useTrial = false) {
    if (useTrial) {
      const ok = await confirm({
        title: t('pro.trial.title'),
        body: t('pro.trial.body', { months: PRO_TRIAL_MONTHS }),
        confirmLabel: t('pro.trial.confirm', { months: PRO_TRIAL_MONTHS }),
      });
      if (!ok) return;
      updateProfile({ pro: { plan: 'trial', since: Date.now() } });
      toast(t('pro.trial.started'));
      closeModal();
      return;
    }
    const link = paymentLinkFor(plan);
    if (link) {
      toast(t('pro.checkout.disabled'), 'info');
      return;
    }
    const ok = await confirm({
      title: t('pro.sandbox.title'),
      body: t('pro.sandbox.body'),
      confirmLabel: t('pro.sandbox.confirm', { plan: meta.name }),
    });
    if (!ok) return;
    updateProfile({ pro: { plan, since: Date.now() } });
    toast(t('pro.welcome'));
    closeModal();
  }

  async function cancelPro() {
    const ok = await confirm({
      title: t('pro.cancel.title'),
      body: t('pro.cancel.body'),
      confirmLabel: t('pro.cancel.confirm'),
      destructive: true,
    });
    if (!ok) return;
    updateProfile({ pro: undefined });
    toast(t('pro.cancel.done'), 'info');
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && closeModal()}>
      {/* Flex column, not a scroller: `.pro-surface` pins overflow hidden, the
          middle section below is the only scroll region, and the CTA footer
          is a flex sibling pinned to the bottom edge — the upgrade actions
          are always visible, never below the fold. */}
      {/* NB: never pass `relative` here — tailwind-merge treats it as the same
          group as the base `fixed`, so the sheet would lose its fixed
          positioning and render in-flow below the fold (overlay blur only).
          `fixed` is already a positioned ancestor, which is all the
          sheen/grain pseudo-elements need. */}
      <DialogContent
        hideHandle
        hideClose
        className="pro-surface sheen max-w-lg border-transparent p-0 pb-0"
      >
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div className="relative h-32 shrink-0 sm:h-40">
          <SheetHandle className="absolute inset-x-0 top-1 z-10 py-2" pillClassName="bg-white/30" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-optimised asset */}
          <img
            src="/images/pro-hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-[var(--ink)]/45 to-transparent" />
          <button
            onClick={closeModal}
            aria-label={t('pro.close')}
            className="glass press absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <div className="absolute right-5 bottom-3 left-5">
            <div className="flex items-center gap-2.5">
              <span
                className="gold-edge flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg,var(--volt),var(--volt-dim))' }}
              >
                <Crown className="h-5 w-5 text-[var(--volt-ink-on)]" aria-hidden />
              </span>
              <div>
                <DialogTitle className="text-xl leading-tight font-extrabold text-[var(--ink-paper)]">
                  SmartFit Pro
                </DialogTitle>
                <DialogDescription className="text-xs text-[rgba(237,235,230,0.75)]">
                  {pro ? t('pro.tagline.member') : t('pro.tagline.locked')}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {pro ? (
            <ManageContent paid={paid} trialing={trialing} state={state} />
          ) : (
            <UpgradeContent plan={plan} setPlan={setPlan} />
          )}
        </div>
        {pro ? (
          <ManageFooter onCancel={cancelPro} onDone={closeModal} />
        ) : (
          <UpgradeFooter
            meta={meta}
            onCheckout={() => checkout(false)}
            onTrial={() => checkout(true)}
            paidDisabled={paidCheckoutConfigured}
            trialDisabled={false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── comparison table ──────────────────────────────────────────────────── */

function ComparisonTable() {
  const { t } = useI18n();
  return (
    <div className="pro-tile overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-[rgba(237,235,230,0.12)] px-3 py-2.5 text-[11px] font-bold tracking-wide uppercase min-[430px]:px-4">
        <span className="pro-muted">{t('pro.table.feature')}</span>
        <span className="pro-muted text-center">{t('pro.table.free')}</span>
        <span className="text-center" style={{ color: 'var(--volt)' }}>
          Pro
        </span>
      </div>
      <ul>
        {PRO_GATES.map((g, i) => {
          const Icon = GATE_ICONS[g.icon] ?? Sparkles;
          return (
            <li
              key={g.label}
              className={cn(
                'grid grid-cols-[1.4fr_1fr_1fr] items-center gap-1.5 px-3 py-2.5 min-[430px]:gap-2 min-[430px]:px-4',
                i > 0 && 'border-t border-[rgba(237,235,230,0.08)]',
              )}
            >
              {/* Long single words ("Achievements", "spreadsheets") are wider
                  than these ~60px columns on phones — break them instead of
                  letting them poke into the next column. */}
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold [overflow-wrap:anywhere] min-[430px]:gap-2 min-[430px]:text-sm">
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--chart-1)' }}
                  aria-hidden
                />
                {g.label}
              </span>
              <span className="pro-muted min-w-0 text-center text-[11px] font-medium [overflow-wrap:anywhere] min-[430px]:text-xs">
                {g.free}
              </span>
              <span className="flex min-w-0 items-center justify-center gap-1 text-center text-[11px] font-bold [overflow-wrap:anywhere] text-[var(--ink-paper)] min-[430px]:text-xs">
                <Check
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: 'var(--volt)' }}
                  aria-hidden
                />
                {g.pro}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Pinned action bar for the dark Pro sheet: a flex sibling (not sticky — the
   sheet itself never scrolls) with an volt divider. On sm+ the base
   DialogFooter resets apply (transparent, static, unpadded). */
const PRO_FOOTER_BAR = 'static mx-0 mb-0 border-t-[rgba(237,235,230,0.12)] bg-black/45';

/* ── upgrade content (scrolls) ─────────────────────────────────────────── */

function UpgradeContent({ plan, setPlan }: { plan: ProPlan; setPlan: (p: ProPlan) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="grid gap-4">
      {/* Launch offer — every upgrade opens with a free Pro period. */}
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3"
        style={{ borderColor: 'rgba(138,210,0,0.4)', background: 'rgba(138,210,0,0.08)' }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(135deg,var(--volt),var(--volt-dim))' }}
        >
          <Sparkles className="h-4 w-4 text-[var(--volt-ink-on)]" aria-hidden />
        </span>
        <p className="min-w-0 text-[13px] leading-snug font-semibold text-[var(--ink-paper)]">
          Upgrade today and your first {PRO_TRIAL_MONTHS} months of Pro are free — no card, cancel
          anytime.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-3">
        {PRO_PLANS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlan(p.id)}
            aria-pressed={plan === p.id}
            className={cn(
              'press relative flex flex-col items-start gap-0.5 rounded-2xl border p-3.5 text-left transition-all',
              // With an odd plan count the last card spans the row as a banner.
              PRO_PLANS.length % 2 === 1 && i === PRO_PLANS.length - 1 && 'col-span-2',
              plan === p.id
                ? 'gold-edge border-transparent bg-[rgba(138,210,0,0.1)]'
                : 'pro-tile border-transparent',
            )}
          >
            {p.featured && (
              <span
                className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase"
                style={{
                  background: 'linear-gradient(135deg,var(--volt),var(--volt-dim))',
                  color: 'var(--volt-ink-on)',
                }}
              >
                {p.note}
              </span>
            )}
            <span className="text-sm font-bold">{p.name}</span>
            <span className="font-display text-2xl font-extrabold tabular-nums">
              {p.price}
              <span className="pro-muted text-xs font-medium">{p.per}</span>
            </span>
            <span className="pro-muted text-xs font-semibold">
              {p.effective ?? t(p.id === 'lifetime' ? 'pro.plan.lifetime' : 'pro.plan.monthly')}
            </span>
            {p.savePct && (
              <span
                className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(138,210,0,0.15)', color: 'var(--volt-soft)' }}
              >
                Save {p.savePct}%
              </span>
            )}
          </button>
        ))}
      </div>

      <ComparisonTable />

      <div className="flex items-center justify-between">
        <p className="pro-muted flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {t(BILLING_MODE === 'sandbox' ? 'pro.billing.sandbox' : 'pro.billing.disabled')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-[rgba(237,235,230,0.8)]"
          onClick={onTrialRestoreNotice}
        >
          <RefreshCw className="h-3.5 w-3.5" /> {t('pro.restore')}
        </Button>
      </div>
    </div>
  );

  function onTrialRestoreNotice() {
    // Restore lives in the sandbox path — inform rather than fake a store call.
    toast('No previous purchases found on this device.', 'info');
  }
}

/* ── upgrade footer (pinned — always visible) ───────────────────────────── */

function UpgradeFooter({
  meta,
  onCheckout,
  onTrial,
  paidDisabled = false,
  trialDisabled = false,
}: {
  meta: (typeof PRO_PLANS)[number];
  onCheckout: () => void;
  onTrial: () => void;
  paidDisabled?: boolean;
  trialDisabled?: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <DialogFooter className={cn(PRO_FOOTER_BAR, 'flex-col sm:flex-col')}>
      <Button
        onClick={onCheckout}
        disabled={paidDisabled}
        className="w-full rounded-2xl text-base font-extrabold"
        style={{
          background: 'linear-gradient(120deg,var(--volt),var(--volt-dim))',
          color: 'var(--primary-foreground)',
          height: '3.25rem',
        }}
      >
        <Crown className="h-4 w-4" /> Continue with {meta.name}
      </Button>
      <Button
        onClick={onTrial}
        disabled={trialDisabled}
        variant="outline"
        className="w-full rounded-2xl border-[rgba(237,235,230,0.25)] bg-transparent text-[rgba(237,235,230,0.9)] hover:bg-[rgba(237,235,230,0.08)] hover:text-[var(--ink-paper)]"
      >
        Get {PRO_TRIAL_MONTHS} months of Pro — free
      </Button>
      {(paidDisabled || trialDisabled) && (
        <p className="pro-muted text-center text-[11px]">
          Pro activation is disabled while billing is still a preview.
        </p>
      )}
    </DialogFooter>
  );
}

/* ── manage content (scrolls) ────────────────────────────────────────────── */

/** Human countdown for the free Pro period: months, then weeks, then days. */
function trialLeftLabel(days: number, t: Translator): string {
  if (days >= 30) return t('pro.trial.leftMonths', { count: Math.round(days / 30) });
  if (days >= 14) return t('pro.trial.leftWeeks', { count: Math.round(days / 7) });
  return t('pro.trial.leftDays', { count: days });
}

function ManageContent({
  paid,
  trialing,
  state,
}: {
  paid: boolean;
  trialing: boolean;
  state: ReturnType<typeof useStore>['state'];
}) {
  const { t, locale } = useI18n();
  const planName = PRO_PLANS.find((p) => p.id === state.profile.pro?.plan)?.name;
  return (
    <div className="grid gap-4">
      <div className="pro-tile flex items-center justify-between rounded-2xl px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold">
              {trialing ? t('pro.status.trial') : (planName ?? t('pro.status.plan'))}
            </p>
            <ProBadge />
          </div>
          <p className="pro-muted mt-0.5 text-xs">
            {trialing
              ? trialLeftLabel(trialDaysLeft(state), t)
              : state.profile.pro
                ? t('pro.status.since', {
                    date: formatDateLabel(toISODate(new Date(state.profile.pro.since)), locale),
                  })
                : t('pro.status.active')}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: 'rgba(138,210,0,0.15)', color: 'var(--volt-soft)' }}
        >
          {t('pro.status.active')}
        </span>
      </div>

      <ComparisonTable />
    </div>
  );
}

/* ── manage footer (pinned — always visible) ────────────────────────────── */

function ManageFooter({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const manageUrl = manageSubscriptionUrl();
  return (
    <DialogFooter className={cn(PRO_FOOTER_BAR, 'flex-col')}>
      <Button
        onClick={onDone}
        className="flex-1 rounded-2xl"
        style={{ background: 'var(--chart-1)', color: 'var(--primary-foreground)' }}
      >
        {t('action.done')}
      </Button>
      {manageUrl && (
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => window.open(manageUrl, '_blank', 'noopener')}
        >
          {t('pro.manage')}
        </Button>
      )}
      <Button onClick={onCancel} variant="ghost" className="text-destructive rounded-2xl">
        {t('pro.cancel.confirm')}
      </Button>
    </DialogFooter>
  );
}
