'use client';

import { useState } from 'react';
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
  PRO_TRIAL_DAYS,
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
};

/**
 * SmartFit Pro preview surface (paid billing is deliberately disabled until
 * server-side entitlements exist).
 *
 * Redesigned as a genuine *premium* surface: a dark volt hero, an anchored
 * yearly plan with a savings ribbon, an honest Free-vs-Pro comparison built
 * from `PRO_GATES` (so the paywall never promises a gate that isn't enforced),
 * and a no-card 14-day trial in local sandbox mode. Real checkout and cloud
 * trials remain disabled until trusted server-side billing exists.
 */
export function ProModal() {
  const { state, updateProfile, cloud } = useStore();
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
      if (cloud) {
        toast('Pro trials are disabled on cloud accounts until billing is connected.', 'info');
        return;
      }
      const ok = await confirm({
        title: 'Start your free trial?',
        body: `${PRO_TRIAL_DAYS} days of every Pro feature, no card required (sandbox). You drop back to the free tier automatically when it ends.`,
        confirmLabel: `Start ${PRO_TRIAL_DAYS}-day trial`,
      });
      if (!ok) return;
      updateProfile({ pro: { plan: 'trial', since: Date.now() } });
      toast('Trial started — enjoy Pro!');
      closeModal();
      return;
    }
    const link = paymentLinkFor(plan);
    if (link || cloud) {
      toast('Paid Pro checkout is disabled until secure server-side billing is live.', 'info');
      return;
    }
    const ok = await confirm({
      title: 'Sandbox checkout',
      body:
        'Paid billing is not connected, so this activation is only a local preview. ' +
        'No payment link or cloud entitlement is created.',
      confirmLabel: `Activate ${meta.name}`,
    });
    if (!ok) return;
    updateProfile({ pro: { plan, since: Date.now() } });
    toast('Welcome to SmartFit Pro');
    closeModal();
  }

  async function cancelPro() {
    const ok = await confirm({
      title: 'Cancel SmartFit Pro?',
      body: 'You keep Pro features until the end of the paid period, then drop to the free tier.',
      confirmLabel: 'Cancel Pro',
      destructive: true,
    });
    if (!ok) return;
    updateProfile({ pro: undefined });
    toast('Pro cancelled', 'info');
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && closeModal()}>
      {/* Flex column, not a scroller: `.pro-surface` pins overflow hidden, the
          middle section below is the only scroll region, and the CTA footer
          is a flex sibling pinned to the bottom edge — the upgrade actions
          are always visible, never below the fold. */}
      <DialogContent
        hideHandle
        hideClose
        className="pro-surface sheen relative max-w-lg border-transparent p-0 pb-0"
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/45 to-transparent" />
          <button
            onClick={closeModal}
            aria-label="Close"
            className="glass press absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <div className="absolute right-5 bottom-3 left-5">
            <div className="flex items-center gap-2.5">
              <span
                className="gold-edge flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg,#9cff00,#76b900)' }}
              >
                <Crown className="h-5 w-5 text-[#2a3000]" aria-hidden />
              </span>
              <div>
                <DialogTitle className="text-xl leading-tight font-extrabold text-[#f5f5f2]">
                  SmartFit Pro
                </DialogTitle>
                <DialogDescription className="text-xs text-[rgba(245,245,242,0.75)]">
                  {pro ? 'Your mvoltship, managed.' : 'Unlock the full engine.'}
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
            paidDisabled={cloud || paidCheckoutConfigured}
            trialDisabled={cloud}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── comparison table ──────────────────────────────────────────────────── */

function ComparisonTable() {
  return (
    <div className="pro-tile overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-[rgba(245,245,242,0.12)] px-3 py-2.5 text-[11px] font-bold tracking-wide uppercase min-[430px]:px-4">
        <span className="pro-muted">Feature</span>
        <span className="pro-muted text-center">Free</span>
        <span className="text-center" style={{ color: '#9cff00' }}>
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
                i > 0 && 'border-t border-[rgba(245,245,242,0.08)]',
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
              <span className="flex min-w-0 items-center justify-center gap-1 text-center text-[11px] font-bold [overflow-wrap:anywhere] text-[#f5f5f2] min-[430px]:text-xs">
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: '#9cff00' }} aria-hidden />
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
const PRO_FOOTER_BAR = 'static mx-0 mb-0 border-t-[rgba(245,245,242,0.12)] bg-black/45';

/* ── upgrade content (scrolls) ─────────────────────────────────────────── */

function UpgradeContent({ plan, setPlan }: { plan: ProPlan; setPlan: (p: ProPlan) => void }) {
  const toast = useToast();
  return (
    <div className="grid gap-4">
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
                ? 'gold-edge border-transparent bg-[rgba(156,255,0,0.1)]'
                : 'pro-tile border-transparent',
            )}
          >
            {p.featured && (
              <span
                className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase"
                style={{ background: 'linear-gradient(135deg,#9cff00,#76b900)', color: '#2a3000' }}
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
              {p.effective ?? (p.id === 'lifetime' ? 'One-time payment' : 'Billed monthly')}
            </span>
            {p.savePct && (
              <span
                className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(156,255,0,0.15)', color: '#cfff55' }}
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
          {BILLING_MODE === 'sandbox'
            ? 'Local preview — no charges or paid entitlement.'
            : 'Paid billing is disabled until server-side provisioning is live.'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-[rgba(245,245,242,0.8)]"
          onClick={onTrialRestoreNotice}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Restore
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
  return (
    <DialogFooter className={cn(PRO_FOOTER_BAR, 'flex-col sm:flex-col')}>
      <Button
        onClick={onCheckout}
        disabled={paidDisabled}
        className="w-full rounded-2xl text-base font-extrabold"
        style={{
          background: 'linear-gradient(120deg,#9cff00,#76b900)',
          color: '#141414',
          height: '3.25rem',
        }}
      >
        <Crown className="h-4 w-4" /> Continue with {meta.name}
      </Button>
      <Button
        onClick={onTrial}
        disabled={trialDisabled}
        variant="outline"
        className="w-full rounded-2xl border-[rgba(245,245,242,0.25)] bg-transparent text-[rgba(245,245,242,0.9)] hover:bg-[rgba(245,245,242,0.08)] hover:text-[#f5f5f2]"
      >
        Try Pro free for {PRO_TRIAL_DAYS} days
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

function ManageContent({
  paid,
  trialing,
  state,
}: {
  paid: boolean;
  trialing: boolean;
  state: ReturnType<typeof useStore>['state'];
}) {
  const planName = PRO_PLANS.find((p) => p.id === state.profile.pro?.plan)?.name;
  return (
    <div className="grid gap-4">
      <div className="pro-tile flex items-center justify-between rounded-2xl px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold">{trialing ? 'Pro Trial' : (planName ?? 'Pro')}</p>
            <ProBadge />
          </div>
          <p className="pro-muted mt-0.5 text-xs">
            {trialing
              ? `${trialDaysLeft(state)} day${trialDaysLeft(state) === 1 ? '' : 's'} left in your trial`
              : state.profile.pro
                ? `Mvolt since ${formatDateLabel(toISODate(new Date(state.profile.pro.since)))}`
                : 'Active'}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: 'rgba(156,255,0,0.15)', color: '#cfff55' }}
        >
          Active
        </span>
      </div>

      <ComparisonTable />
    </div>
  );
}

/* ── manage footer (pinned — always visible) ────────────────────────────── */

function ManageFooter({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const manageUrl = manageSubscriptionUrl();
  return (
    <DialogFooter className={cn(PRO_FOOTER_BAR, 'flex-col')}>
      <Button
        onClick={onDone}
        className="flex-1 rounded-2xl"
        style={{ background: 'var(--chart-1)', color: '#141414' }}
      >
        Done
      </Button>
      {manageUrl && (
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => window.open(manageUrl, '_blank', 'noopener')}
        >
          Manage subscription
        </Button>
      )}
      <Button onClick={onCancel} variant="ghost" className="rounded-2xl text-[#ff6b5e]">
        Cancel Pro
      </Button>
    </DialogFooter>
  );
}
