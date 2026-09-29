'use client';

import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  ClipboardPlus,
  Dumbbell,
  Heart,
  Moon,
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
  label: string;
  icon: LucideIcon;
  modal?: 'workout' | 'meal' | 'body' | 'sleep' | 'vitals';
  href?: string;
};

const ACTIONS: QuickAction[] = [
  { id: 'workout', label: 'Log workout', icon: Dumbbell, modal: 'workout' },
  { id: 'meal', label: 'Log meal', icon: UtensilsCrossed, modal: 'meal' },
  { id: 'measurement', label: 'Weight / Measure', icon: ClipboardPlus, modal: 'body' },
  { id: 'sleep', label: 'Log sleep', icon: Moon, modal: 'sleep' },
  { id: 'vitals', label: 'Log vitals', icon: Heart, modal: 'vitals' },
  { id: 'run', label: 'Start run', icon: Activity, href: '/dashboard/run' },
  { id: 'goals', label: 'Goals', icon: Target, href: '/dashboard/goals' },
  { id: 'plan', label: 'Plan', icon: CalendarCheck, href: '/dashboard/plan' },
  { id: 'progress', label: 'Trends', icon: BarChart3, href: '/dashboard/progress' },
  { id: 'coach', label: 'Coach', icon: Sparkles, href: '/dashboard/coach' },
];

/** A single, consistent entry point to the actions available in the web app. */
export function QuickActionsModal() {
  const router = useRouter();
  const { closeModal, openModal, openWith } = useModals();
  const payload = usePayload('quick-actions');
  const open = payload !== null;

  function choose(action: QuickAction) {
    if (action.href) {
      closeModal();
      router.push(action.href);
      return;
    }
    if (!action.modal) return;
    if (action.modal === 'meal') return openWith({ kind: 'meal' });
    if (action.modal === 'sleep') return openWith({ kind: 'sleep' });
    if (action.modal === 'vitals') return openWith({ kind: 'vitals' });
    openModal(action.modal);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeModal()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
          <DialogDescription>Log something, start a workout, or jump to a tool.</DialogDescription>
        </DialogHeader>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACTIONS.map(({ id, label, icon: Icon, ...action }) => (
            <button
              key={id}
              type="button"
              onClick={() => choose({ id, label, icon: Icon, ...action })}
              className="bg-card border-border hover:border-volt/60 hover:bg-secondary/70 focus-visible:ring-ring group relative flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="bg-volt/10 text-volt group-hover:bg-volt group-hover:text-ink flex h-10 w-10 items-center justify-center rounded-xl transition-colors">
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <span className="mt-4 text-sm leading-snug font-semibold">{label}</span>
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
