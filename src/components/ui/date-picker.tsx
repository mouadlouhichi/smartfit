'use client';

import * as React from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react';
import {
  addDaysIso,
  calendarCells,
  formatTriggerDate,
  isDayDisabled,
  isIsoDate,
  longDateLabel,
  monthOf,
  parseIsoDate,
  shiftMonth,
  startOfToday,
  weekdayHeader,
  type MonthPage,
} from '@/lib/date-picker';
import { cn } from '@/lib/utils';

/**
 * DatePicker — the design-system date control.
 *
 * Replaces native `<input type="date">`: some devices open the browser's
 * picker overlay the moment the dialog appears (or steal a tap to open before
 * the user is ready). This control stays fully closed until the trigger is
 * explicitly pressed, and the calendar then opens as an in-flow popover.
 *
 * Accessibility mirrors a real calendar: each day is a button with a full
 * date label, the arrow keys move day-by-day / week-by-week, Home/End jump to
 * the week's first/last day, Escape closes and returns focus to the trigger,
 * and reduced-motion users get the same behavior without animation.
 *
 * All date math lives in `@/lib/date-picker` (unit-tested).
 */

export interface DatePickerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type'
> {
  /** ISO date `yyyy-mm-dd`. */
  value: string;
  onValueChange: (iso: string) => void;
  /** First day of the calendar week — 0 = Sunday, 1 = Monday (app default). */
  weekStartsOn?: 0 | 1;
  /** ISO dates after this are disabled (defaults to today — no future logs). */
  max?: string;
  /** ISO dates before this are disabled. */
  min?: string;
}

export function DatePicker({
  value,
  onValueChange,
  weekStartsOn = 1,
  max,
  min,
  className,
  disabled,
  ...rest
}: DatePickerProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const todayIso = startOfToday();
  const bounds = React.useMemo(() => ({ max, min }), [max, min]);

  // The day the calendar is on: the current value, else today.
  const [focusIso, setFocusIso] = React.useState<string>(() =>
    isIsoDate(value) ? value : todayIso,
  );

  // Which month is on screen: derived from the focused day, so arrow
  // navigation across a month boundary flips the page naturally.
  const [view, setView] = React.useState<MonthPage>(() =>
    monthOf(isIsoDate(value) ? value : todayIso),
  );

  const lastValue = React.useRef(value);
  React.useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    if (!isIsoDate(value)) return;
    setFocusIso(value);
    setView(monthOf(value));
  }, [value]);

  // Close on outside pointer press (same contract as ui/select). The check
  // covers the whole popover: month arrows and quick picks live outside the
  // day grid, and closing on their pointerdown would swallow the click.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Opening moves focus onto the current (or today's) day cell.
  React.useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusIso}"]`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function jumpTo(iso: string) {
    setFocusIso(iso);
    setView(monthOf(iso));
  }

  function pick(iso: string) {
    onValueChange(iso);
    setOpen(false);
    // The clicked day unmounts with the popover; keep focus on the trigger so
    // the dialog's tab order never drops to the body.
    triggerRef.current?.focus();
  }

  function pickToday() {
    const iso = startOfToday();
    jumpTo(iso);
    pick(iso);
  }

  function pickYesterday() {
    const iso = addDaysIso(startOfToday(), -1);
    jumpTo(iso);
    pick(iso);
  }

  function pickLastWeek() {
    const iso = addDaysIso(startOfToday(), -7);
    jumpTo(iso);
    pick(iso);
  }

  /** Move the roving focus by `days`, paging the month when it crosses over. */
  function moveFocus(days: number) {
    const next = addDaysIso(focusIso, days);
    if (isDayDisabled(next, bounds)) return; // never land on a blocked day
    setFocusIso(next);
    setView(monthOf(next));
    // Focus the new cell after the month page (if any) has re-rendered.
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
    });
  }

  function handleGridKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-7);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(7);
        break;
      case 'Home': {
        e.preventDefault();
        moveFocus(-weekOffset); // week start
        break;
      }
      case 'End': {
        e.preventDefault();
        moveFocus(6 - weekOffset); // week end
        break;
      }
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  }

  const cells = calendarCells(view.y, view.m, weekStartsOn);
  const weekdays = weekdayHeader(weekStartsOn);
  const viewLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  /** Row of the focused day within the week — 0 = the configured week start. */
  const weekOffset = (parseIsoDate(focusIso).getDay() - weekStartsOn + 7) % 7;

  // Month paging stops at the bounds (default: no future logs).
  const maxPage = monthOf(max ?? todayIso);
  const minPage = min !== undefined ? monthOf(min) : null;
  const beforeMax = view.y < maxPage.y || (view.y === maxPage.y && view.m < maxPage.m);
  const afterMin =
    minPage === null || view.y > minPage.y || (view.y === minPage.y && view.m > minPage.m);

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'bg-secondary text-foreground hover:bg-secondary/70 focus-visible:ring-ring focus-visible:border-ring focus-visible:bg-background',
          'flex h-11 w-full items-center gap-2 rounded-xl border border-transparent px-3 text-left text-base font-medium transition-colors sm:h-10 sm:text-sm',
          'focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5',
        )}
        {...rest}
        // The abbreviated label is visual only — announce the full date.
        aria-label={
          rest['aria-label'] ?? (isIsoDate(value) ? `Date: ${longDateLabel(value)}` : undefined)
        }
      >
        <CalendarDays className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{formatTriggerDate(value)}</span>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {/* Fixed-width popover: it must clear the trigger's narrow 2-column cell
          on phones without ever pushing past the viewport. */}
      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="border-border bg-popover text-popover-foreground animate-fade-in absolute top-full left-0 z-50 mt-1.5 w-[19.5rem] max-w-[calc(100vw-3rem)] rounded-2xl border p-3 shadow-lg shadow-black/10"
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!afterMin}
              onClick={() => setView((v) => shiftMonth(v, -1))}
              className="hover:bg-secondary text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-sm font-bold" aria-live="polite">
              {viewLabel}
            </p>
            <button
              type="button"
              aria-label="Next month"
              disabled={!beforeMax}
              onClick={() => setView((v) => shiftMonth(v, 1))}
              className="hover:bg-secondary text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Weekday header */}
          <div className="text-muted-foreground mt-2 grid grid-cols-7 text-center">
            {weekdays.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-bold tracking-wide uppercase">
                {w}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div
            ref={gridRef}
            role="grid"
            aria-label="Calendar"
            onKeyDown={handleGridKey}
            className="grid grid-cols-7"
          >
            {cells.map((iso, i) => {
              if (!iso) return <span key={`blank-${i}`} className="h-9 w-full" />;
              const disabledDay = isDayDisabled(iso, bounds);
              const selected = iso === value;
              const isToday = iso === todayIso;
              const focused = iso === focusIso;
              return (
                <div key={iso} className="flex justify-center">
                  <button
                    type="button"
                    data-date={iso}
                    tabIndex={focused ? 0 : -1}
                    aria-label={longDateLabel(iso)}
                    aria-pressed={selected}
                    disabled={disabledDay}
                    onClick={() => pick(iso)}
                    className={cn(
                      // Fluid width keeps 7 columns inside the popover on every
                      // viewport (a fixed 36px cell overflows on a 320px phone).
                      'flex h-9 w-full max-w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                      'focus-visible:ring-ring focus-visible:ring-offset-popover focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
                      selected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                        : disabledDay
                          ? 'text-muted-foreground/30 cursor-not-allowed hover:bg-transparent'
                          : 'text-popover-foreground hover:bg-secondary',
                      !selected && !disabledDay && isToday && 'ring-primary/40 ring-1 ring-inset',
                    )}
                  >
                    {Number(iso.slice(8))}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-muted-foreground border-border/70 mt-2 flex items-center gap-1.5 border-t pt-2 text-[11px]">
            <CornerDownLeft className="hidden h-3 w-3 shrink-0 sm:block" aria-hidden />
            Choose the day you actually trained — past dates are welcome.
          </p>

          {/* Quick picks */}
          <div className="mt-2 flex items-center justify-between gap-1">
            {[
              { label: 'Today', iso: todayIso, primary: true },
              { label: '7 days ago', iso: addDaysIso(todayIso, -7), primary: false },
              { label: 'Yesterday', iso: addDaysIso(todayIso, -1), primary: false },
            ].map((quick) => {
              const onPick =
                quick.label === 'Today'
                  ? pickToday
                  : quick.label === 'Yesterday'
                    ? pickYesterday
                    : pickLastWeek;
              const active = value === quick.iso;
              return (
                <button
                  key={quick.label}
                  type="button"
                  onClick={onPick}
                  aria-pressed={active}
                  className={cn(
                    'focus-visible:ring-ring flex items-center rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    quick.primary
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    active && (quick.primary ? 'bg-primary/10' : 'bg-secondary text-foreground'),
                  )}
                >
                  {quick.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
