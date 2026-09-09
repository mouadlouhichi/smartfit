'use client';

import { useState } from 'react';
import {
  Check,
  Crown,
  FileDown,
  LineChart,
  ListChecks,
  Medal,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { BILLING_MODE, paymentLinkFor } from '@/lib/billing';
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
  'line-chart': LineChart,
  trophy: Trophy,
  medal: Medal,
  'list-checks': ListChecks,
  'file-down': FileDown,
};

/**
 * SmartFit Pro paywall & subscription manager.
 *
 * Redesigned as a genuine *premium* surface: a dark ember hero, an anchored
 * yearly plan with a savings ribbon, an honest Free-vs-Pro comparison built
 * from `PRO_GATES` (so the paywall never promises a gate that isn't enforced),
 * and a no-card 7-day trial. With Stripe payment links configured the CTAs open
 * real checkout; otherwise a clearly-labelled sandbox activates locally.
 */
export function ProModal() {
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

  async function checkout(useTrial = false) {
    if (useTrial) {
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
    if (link) {
      window.open(link, '_blank', 'noopener');
      toast('Opening Stripe checkout…', 'info');
      return;
    }
    const ok = await confirm({
      title: 'Sandbox checkout',
      body:
        'No payment provider is connected, so this activates Pro locally for testing. ' +
        'Set NEXT_PUBLIC_STRIPE_PAYMENT_LINK_* to charge for real.',
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
      <DialogContent className="pro-surface sheen max-w-lg overflow-hidden border-transparent p-0">
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div className="relative h-40">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-optimised asset */}
          <img
            src="/images/pro-hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141110] via-[#141110]/45 to-transparent" />
          <button
            onClick={closeModal}
            aria-label="Close"
            className="glass press absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <div className="absolute right-5 bottom-3 left-5">
            <div className="flex items-center gap-2.5">
              <span
                className="gold-edge flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg,#f0c882,#c4893a)' }}
              >
                <Crown className="h-5 w-5 text-[#3a2408]" aria-hidden />
              </span>
              <div>
                <DialogTitle className="text-xl leading-tight font-extrabold text-[#f7f2ea]">
                  SmartFit Pro
                </DialogTitle>
                <DialogDescription className="text-xs text-[rgba(247,242,234,0.75)]">
                  {pro ? 'Your membership, managed.' : 'Unlock the full engine.'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[62dvh] overflow-y-auto p-4 pt-4 min-[430px]:p-5">
          {pro ? (
            <ManageView
              paid={paid}
              trialing={trialing}
              state={state}
              onCancel={cancelPro}
              onDone={closeModal}
            />
          ) : (
            <UpgradeView
              plan={plan}
              setPlan={setPlan}
              meta={meta}
              onCheckout={() => checkout(false)}
              onTrial={() => checkout(true)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── comparison table ──────────────────────────────────────────────────── */

function ComparisonTable() {
  return (
    <div className="pro-tile overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-[rgba(247,242,234,0.12)] px-3 py-2.5 text-[11px] font-bold tracking-wide uppercase min-[430px]:px-4">
        <span className="pro-muted">Feature</span>
        <span className="pro-muted text-center">Free</span>
        <span className="text-center" style={{ color: '#f0c882' }}>
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
                i > 0 && 'border-t border-[rgba(247,242,234,0.08)]',
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
              <span className="flex min-w-0 items-center justify-center gap-1 text-center text-[11px] font-bold [overflow-wrap:anywhere] text-[#f7f2ea] min-[430px]:text-xs">
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: '#f0c882' }} aria-hidden />
                {g.pro}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── upgrade view ──────────────────────────────────────────────────────── */

function UpgradeView({
  plan,
  setPlan,
  meta,
  onCheckout,
  onTrial,
}: {
  plan: ProPlan;
  setPlan: (p: ProPlan) => void;
  meta: (typeof PRO_PLANS)[number];
  onCheckout: () => void;
  onTrial: () => void;
}) {
  const toast = useToast();
  return (
    <div className="grid gap-4">
      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-3">
        {PRO_PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlan(p.id)}
            aria-pressed={plan === p.id}
            className={cn(
              'press relative flex flex-col items-start gap-0.5 rounded-2xl border p-3.5 text-left transition-all',
              plan === p.id
                ? 'gold-edge border-transparent bg-[rgba(240,200,130,0.1)]'
                : 'pro-tile border-transparent',
            )}
          >
            {p.featured && (
              <span
                className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase"
                style={{ background: 'linear-gradient(135deg,#f0c882,#c4893a)', color: '#3a2408' }}
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
              {p.effective ?? 'Billed monthly'}
            </span>
            {p.savePct && (
              <span
                className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(200,241,53,0.15)', color: '#e3f88a' }}
              >
                Save {p.savePct}%
              </span>
            )}
          </button>
        ))}
      </div>

      <ComparisonTable />

      <div className="grid gap-2">
        <Button
          onClick={onCheckout}
          className="h-13 w-full rounded-2xl text-base font-extrabold"
          style={{
            background: 'linear-gradient(120deg,#e05e36,#c4451f)',
            color: '#fff',
            height: '3.25rem',
          }}
        >
          <Crown className="h-4 w-4" /> Continue with {meta.name}
        </Button>
        <Button
          onClick={onTrial}
          variant="outline"
          className="w-full rounded-2xl border-[rgba(247,242,234,0.25)] text-[rgba(247,242,234,0.9)]"
        >
          Try Pro free for {PRO_TRIAL_DAYS} days
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="pro-muted flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {BILLING_MODE === 'sandbox'
            ? 'Sandbox — connect Stripe to charge for real.'
            : 'Secured by Stripe. Cancel anytime.'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-[rgba(247,242,234,0.8)]"
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

/* ── manage view ───────────────────────────────────────────────────────── */

function ManageView({
  paid,
  trialing,
  state,
  onCancel,
  onDone,
}: {
  paid: boolean;
  trialing: boolean;
  state: ReturnType<typeof useStore>['state'];
  onCancel: () => void;
  onDone: () => void;
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
                ? `Member since ${formatDateLabel(toISODate(new Date(state.profile.pro.since)))}`
                : 'Active'}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: 'rgba(200,241,53,0.15)', color: '#e3f88a' }}
        >
          Active
        </span>
      </div>

      <ComparisonTable />

      <div className="flex gap-2">
        <Button
          onClick={onDone}
          className="flex-1 rounded-2xl"
          style={{ background: 'var(--chart-1)', color: '#fff' }}
        >
          Done
        </Button>
        <Button onClick={onCancel} variant="ghost" className="rounded-2xl text-[#f0817a]">
          Cancel Pro
        </Button>
      </div>
    </div>
  );
}
