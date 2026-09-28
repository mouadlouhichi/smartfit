'use client';

import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  ClipboardPlus,
  Dumbbell,
  Sparkles,
  Target,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n-context';
import { useModals, usePayload } from '../modal-context';

type QuickAction = {
  id: string;
  labelKey:
    | 'quickActions.workout'
    | 'quickActions.meal'
    | 'quickActions.measurement'
    | 'quickActions.run'
    | 'quickActions.goals'
    | 'quickActions.plan'
    | 'quickActions.progress'
    | 'quickActions.coach';
  icon: LucideIcon;
  modal?: 'workout' | 'meal' | 'body';
  href?: string;
};

const ACTIONS: QuickAction[] = [
  { id: 'workout', labelKey: 'quickActions.workout', icon: Dumbbell, modal: 'workout' },
  { id: 'meal', labelKey: 'quickActions.meal', icon: UtensilsCrossed, modal: 'meal' },
  { id: 'measurement', labelKey: 'quickActions.measurement', icon: ClipboardPlus, modal: 'body' },
  { id: 'run', labelKey: 'quickActions.run', icon: Activity, href: '/dashboard/run' },
  { id: 'goals', labelKey: 'quickActions.goals', icon: Target, href: '/dashboard/goals' },
  { id: 'plan', labelKey: 'quickActions.plan', icon: CalendarCheck, href: '/dashboard/plan' },
  {
    id: 'progress',
    labelKey: 'quickActions.progress',
    icon: BarChart3,
    href: '/dashboard/progress',
  },
  { id: 'coach', labelKey: 'quickActions.coach', icon: Sparkles, href: '/dashboard/coach' },
];

/** A single, consistent entry point to the actions available in the web app. */
export function QuickActionsModal() {
  const router = useRouter();
  const { t } = useI18n();
  const { openModal, openWith, closeModal } = useModals();
  const payload = usePayload('quick-actions');
  const open = payload !== null;

  function choose(action: QuickAction) {
    if (action.href) {
      closeModal();
      router.push(action.href);
      return;
    }
    if (action.modal === 'meal') {
      openWith({ kind: 'meal' });
      return;
    }
    if (action.modal) openModal(action.modal);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeModal()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('quickActions.title')}</DialogTitle>
          <DialogDescription>{t('quickActions.description')}</DialogDescription>
        </DialogHeader>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACTIONS.map(({ id, labelKey, icon: Icon, ...action }) => (
            <button
              key={id}
              type="button"
              onClick={() => choose({ id, labelKey, icon: Icon, ...action })}
              className="bg-card border-border hover:border-volt/60 hover:bg-secondary/70 focus-visible:ring-ring group relative flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="bg-volt/10 text-volt group-hover:bg-volt group-hover:text-ink flex h-10 w-10 items-center justify-center rounded-xl transition-colors">
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <span className="mt-4 text-sm leading-snug font-semibold">{t(labelKey)}</span>
              {action.href && (
                <ArrowUpRight
                  aria-hidden
                  className="text-muted-foreground absolute top-4 right-4 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
