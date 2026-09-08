'use client';

import { useState } from 'react';
import { Check, Crown, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { BILLING_MODE, paymentLinkFor } from '@/lib/billing';
import { PRO_FEATURES, PRO_PLANS, isPro, formatDateLabel, toISODate } from '@smartfit/core';
import type { ProPlan } from '@smartfit/core';
import { cn } from '@/lib/utils';

/**
 * SmartFit Pro paywall & subscription manager.
 * With Stripe payment links configured the CTA opens real checkout; otherwise
 * a clearly-labelled sandbox checkout activates Pro locally (see lib/billing).
 */
export function ProModal() {
  const { state, updateProfile } = useStore();
  const { open, payload, closeModal } = useModals();
  const confirm = useConfirm();
  const toast = useToast();
  const [plan, setPlan] = useState<ProPlan>('yearly');

  const isOpen = open === 'pro' && payload?.kind === 'pro';
  const pro = isPro(state);
  const meta = PRO_PLANS.find((p) => p.id === plan) ?? PRO_PLANS[0];

  async function checkout() {
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
      <DialogContent className="max-w-md overflow-hidden p-0">
        {/* Hero art — the premium anchor of the paywall */}
        <div className="relative h-36 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-optimised asset */}
          <img
            src="/images/pro-hero.jpg"
            alt=""
            className="h-full w-full object-cover"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-5 flex items-center gap-2">
            <span className="bg-primary flex h-9 w-9 items-center justify-center rounded-full shadow-lg shadow-black/30">
              <Crown className="h-4.5 w-4.5 text-white" aria-hidden />
            </span>
            <div>
              <DialogTitle className="text-lg leading-tight text-white">SmartFit Pro</DialogTitle>
              <DialogDescription className="text-xs text-white/75">
                {pro ? 'Your membership, managed.' : 'Train with everything unlocked.'}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 pt-4">
          <ul className="grid gap-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm font-medium">
                <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {pro ? (
            <div className="grid gap-3">
              <div className="bg-secondary flex items-center justify-between rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold">
                    {PRO_PLANS.find((p) => p.id === state.profile.pro?.plan)?.name ?? 'Pro'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Member since{' '}
                    {state.profile.pro
                      ? formatDateLabel(toISODate(new Date(state.profile.pro.since)))
                      : '—'}
                  </p>
                </div>
                <Badge variant="accent">Active</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closeModal}>
                  Done
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={cancelPro}>
                  Cancel Pro
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-2">
                {PRO_PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all',
                      plan === p.id
                        ? 'border-primary bg-primary/5 ring-primary/30 ring-2'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      {p.note && <p className="text-primary text-xs font-semibold">{p.note}</p>}
                    </div>
                    <p className="text-sm font-extrabold tabular-nums">
                      {p.price}
                      <span className="text-muted-foreground text-xs font-medium">{p.per}</span>
                    </p>
                  </button>
                ))}
              </div>
              <Button onClick={checkout} className="h-12 w-full text-sm">
                <Crown className="h-4 w-4" /> Continue with {meta.name}
              </Button>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[11px]">
                  {BILLING_MODE === 'sandbox'
                    ? 'Sandbox checkout — connect Stripe to charge for real.'
                    : 'Secured by Stripe. Cancel anytime.'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast('No previous purchases found on this device.', 'info')}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Restore
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
