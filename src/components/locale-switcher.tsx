'use client';

import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-context';

/**
 * The one, design-system language switcher.
 *
 * A row of pressed-state buttons rather than a `<select>`: with two locales the
 * current language should be *visible* — you can see which one is active before
 * you touch anything, and one click changes it. Adding a third locale still
 * fits, so this stays a segmented control instead of a menu.
 *
 * The choice lands on `profile.locale`, which is why it survives a reload and
 * reaches the mobile app. Outside a store (public pages) `setLocale` is a
 * no-op, so this renders read-only there rather than pretending to work.
 *
 * Each button is labelled in its own language ("Français", not "French"):
 * naming a language in a language you cannot read is a puzzle.
 */
export interface LocaleSwitcherProps {
  /** Show the icon + title + subtitle header above the buttons. */
  header?: boolean;
  className?: string;
  /** `sm` is for the settings grid; `md` for a page-level section. */
  size?: 'sm' | 'md';
}

export function LocaleSwitcher({ header = false, className, size = 'md' }: LocaleSwitcherProps) {
  const { locale, setLocale, locales, t } = useI18n();

  return (
    <div className={className}>
      {header && (
        <div className="mb-3 flex items-start gap-3">
          <span
            aria-hidden
            className="bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          >
            <Languages className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">{t('language.title')}</p>
            <p className="text-muted-foreground text-xs">{t('language.subtitle')}</p>
          </div>
        </div>
      )}
      <div
        role="group"
        aria-label={t('language.title')}
        className={cn('flex flex-wrap gap-2', !header && 'gap-1.5')}
      >
        {locales.map((option) => {
          const active = locale === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setLocale(option.id)}
              className={cn(
                'focus-visible:ring-ring rounded-full font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                size === 'md' ? 'px-3.5 py-2 text-xs' : 'px-3 py-1.5 text-[11px]',
                active
                  ? 'bg-volt text-ink shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {option.native}
            </button>
          );
        })}
      </div>
    </div>
  );
}
