'use client';

import { useMemo, useState } from 'react';
import type { HeatmapCell, HeatmapWeek } from '@smartfit/core';
import { formatDateLabel, formatMinutes, weekdayLabels } from '@smartfit/core';
import { useI18n } from '@/lib/i18n-context';

/**
 * GitHub-style consistency grid, one column per week ending with the current
 * week. Hovering (or focusing, for keyboard users) a day surfaces what
 * happened on it — minutes and session count.
 *
 * Rows are laid out by the athlete's week start so Monday-first users see a
 * Monday-at-top column, matching the rest of the app.
 */
export function ConsistencyHeatmap({
  weeks,
  activeDays,
  weekStartsOn = 1,
}: {
  weeks: HeatmapWeek[];
  activeDays: number;
  weekStartsOn?: 0 | 1;
}) {
  const [hover, setHover] = useState<HeatmapCell | null>(null);
  const { t, locale } = useI18n();

  // Day labels come from Intl in the interface language, rotated so index 0 is
  // the athlete's week start.
  const labels = useMemo(() => {
    const days = weekdayLabels(locale, 'short');
    return [...days.slice(weekStartsOn), ...days.slice(0, weekStartsOn)];
  }, [weekStartsOn, locale]);

  /** "3 sessions, 48m" — or the rest-day copy when nothing was logged. */
  const cellSummary = (cell: HeatmapCell) =>
    cell.sessions
      ? t('heat.sessions', { count: cell.sessions, minutes: formatMinutes(cell.minutes) })
      : t('heat.restDay');

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-bold">
          {t('heat.daysTrained', { count: activeDays })}
          <span className="text-muted-foreground font-medium">
            {t('heat.lastWeeks', { count: weeks.length })}
          </span>
        </p>
        <div className="flex items-center gap-1" aria-hidden>
          <span className="text-muted-foreground text-[10px]">{t('heat.less')}</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`heat-${l} h-2.5 w-2.5 rounded-[4px]`} />
          ))}
          <span className="text-muted-foreground text-[10px]">{t('heat.more')}</span>
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="flex gap-1.5" role="grid" aria-label={t('heat.gridAria')}>
          {/* Row labels column */}
          <div className="flex flex-col gap-1.5 pr-1">
            {labels.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="text-muted-foreground flex h-3.5 items-center text-[9px] font-semibold uppercase"
                aria-hidden={i % 2 === 1}
              >
                {i % 2 === 0 ? d : ''}
              </span>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1.5" role="row">
              {week.cells.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  role="gridcell"
                  disabled={cell.future}
                  onMouseEnter={() => setHover(cell)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(cell)}
                  onBlur={() => setHover(null)}
                  aria-label={`${formatDateLabel(cell.date, locale)}: ${cellSummary(cell)}`}
                  className={`heat-${cell.level} press h-3.5 w-3.5 rounded-[4px] transition-transform ${
                    cell.future ? 'opacity-30' : 'hover:scale-125 focus-visible:scale-125'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground min-h-[1.25rem] text-xs" aria-live="polite">
        {hover && !hover.future
          ? `${formatDateLabel(hover.date, locale)} — ${cellSummary(hover)}`
          : t('heat.hoverHint')}
      </div>
    </div>
  );
}
