'use client';

import * as React from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateLabel, relativeDay, toISODate } from '@smartfit/core';
import { cn } from '@/lib/utils';

interface DatePickerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange' | 'type'
> {
  value: string;
  onChange: (value: string) => void;
  /** Open the calendar as soon as the field mounts. Useful in log flows. */
  openOnMount?: boolean;
}

/**
 * A small date-only calendar for forms where the browser's native date input
 * would clash with the product's visual language. Dates are kept as local
 * ISO days — no UTC conversion means a workout never jumps to the day before
 * or after it around midnight.
 */
const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ className, value, onChange, openOnMount = false, disabled, id, ...props }, ref) => {
    const selected = parseISODate(value) ?? startOfDay(new Date());
    const [open, setOpen] = React.useState(openOnMount);
    const [month, setMonth] = React.useState(() => firstOfMonth(selected));
    const rootRef = React.useRef<HTMLDivElement>(null);
    const panelId = React.useId();

    // If an existing record is loaded after mount, keep the visible month in
    // step with that record instead of leaving the user on today's month.
    React.useEffect(() => {
      const next = parseISODate(value);
      if (next) setMonth(firstOfMonth(next));
    }, [value]);

    React.useEffect(() => {
      if (!open) return;
      function onPointerDown(event: PointerEvent) {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      }
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    React.useEffect(() => {
      if (!open) return;
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
        }
      }
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    function pick(next: Date) {
      onChange(toISODate(next));
      setMonth(firstOfMonth(next));
      setOpen(false);
    }

    function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      }
    }

    const days = calendarDays(month);
    const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const today = toISODate(new Date());
    const yesterday = toISODate(addDays(new Date(), -1));
    const lastWeek = toISODate(addDays(new Date(), -7));

    return (
      <div ref={rootRef} className="relative min-w-0">
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onKeyDown={handleTriggerKeyDown}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'bg-secondary text-foreground hover:bg-secondary/70 focus-visible:ring-ring focus-visible:border-ring focus-visible:bg-background',
            'flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-transparent px-3.5 text-left transition-colors',
            'focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5',
            className,
          )}
          {...props}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="bg-primary/12 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <CalendarDays className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="text-muted-foreground block text-[10px] leading-none font-bold tracking-[0.12em] uppercase">
                {relativeDay(value || today)}
              </span>
              <span className="mt-1 block truncate text-sm font-extrabold sm:text-base">
                {formatDateLabel(value || today)}
              </span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>

        {open && (
          <div
            id={panelId}
            role="dialog"
            aria-label="Choose workout date"
            className="border-border bg-popover text-popover-foreground animate-fade-in absolute top-[calc(100%+0.5rem)] right-0 left-0 z-40 rounded-2xl border p-3 shadow-xl shadow-black/10 sm:p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
                  Workout date
                </p>
                <p className="mt-1 text-sm font-extrabold">{formatDateLabel(value || today)}</p>
              </div>
              <div className="bg-secondary flex items-center gap-1 rounded-xl p-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth((current) => addMonths(current, -1))}
                  className="text-muted-foreground hover:text-foreground hover:bg-card flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <span className="min-w-[7.5rem] text-center text-xs font-bold">{monthLabel}</span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth((current) => addMonths(current, 1))}
                  className="text-muted-foreground hover:text-foreground hover:bg-card flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <QuickDateButton
                label="Today"
                date={today}
                selected={value === today}
                onPick={pick}
              />
              <QuickDateButton
                label="Yesterday"
                date={yesterday}
                selected={value === yesterday}
                onPick={pick}
              />
              <QuickDateButton
                label="7 days ago"
                date={lastWeek}
                selected={value === lastWeek}
                onPick={pick}
              />
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center">
              {weekdayLabels.map((label) => (
                <span
                  key={label}
                  className="text-muted-foreground py-1 text-[10px] font-bold tracking-wide uppercase"
                >
                  {label}
                </span>
              ))}
            </div>
            <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const iso = toISODate(day);
                const outside = day.getMonth() !== month.getMonth();
                const isSelected = iso === value;
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    aria-label={day.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    aria-selected={isSelected}
                    onClick={() => pick(day)}
                    className={cn(
                      'relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-colors sm:min-h-10',
                      'hover:bg-secondary focus-visible:ring-ring focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none',
                      outside && 'text-muted-foreground/45 font-medium',
                      isToday && !isSelected && 'text-primary ring-primary/35 ring-1',
                      isSelected && 'bg-primary text-primary-foreground shadow-sm',
                    )}
                  >
                    {day.getDate()}
                    {isSelected && <Check className="absolute right-1 bottom-1 h-2.5 w-2.5" />}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-3 text-center text-[11px]">
              Choose the day you actually trained — past dates are welcome.
            </p>
          </div>
        )}
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';

function QuickDateButton({
  label,
  date,
  selected,
  onPick,
}: {
  label: string;
  date: string;
  selected: boolean;
  onPick: (date: Date) => void;
}) {
  const parsed = parseISODate(date) ?? new Date();
  return (
    <button
      type="button"
      onClick={() => onPick(parsed)}
      className={cn(
        'flex min-h-9 items-center justify-center rounded-xl border px-2 text-[11px] font-bold transition-colors',
        selected
          ? 'border-primary/25 bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground',
      )}
    >
      {selected && <Check className="mr-1 h-3 w-3" aria-hidden />}
      {label}
    </button>
  );
}

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function calendarDays(month: Date): Date[] {
  const first = firstOfMonth(month);
  // Monday-first grid: Sunday (0) becomes the seventh column.
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export { DatePicker };
