'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALES,
  createTranslator,
  isLocale,
  localeDir,
  resolveLocale,
  type Locale,
  type Translator,
} from '@smartfit/core';
import { useStore } from './store-context';

/**
 * Locale for the interface.
 *
 * The athlete's choice lives in `profile.locale`, which means it syncs like
 * every other preference and travels to the mobile app for free. The device
 * language is only consulted when no choice has been made.
 *
 * Two details worth keeping:
 *
 *  - The device language is read *after* mount. Reading `navigator.languages`
 *    during render would produce different markup on the server and the
 *    client, which React reports as a hydration mismatch on every page.
 *  - `useI18n` works outside the provider (the public landing page has no
 *    store), falling back to the device language, so a component never has to
 *    care where it is rendered.
 */

export interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Translator;
  /** Persist a new choice. No-op when there is no store (public pages). */
  setLocale: (locale: Locale) => void;
  /** True when a choice has been stored, false when following the device. */
  explicit: boolean;
  /** The list the switcher renders. */
  locales: typeof LOCALES;
}

const fallbackTranslator = createTranslator(DEFAULT_LOCALE);

const FALLBACK: I18nValue = {
  locale: DEFAULT_LOCALE,
  dir: 'ltr',
  t: fallbackTranslator,
  setLocale: () => undefined,
  explicit: false,
  locales: LOCALES,
};

const I18nContext = createContext<I18nValue>(FALLBACK);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { state, updateProfile } = useStore();
  const [deviceLanguages, setDeviceLanguages] = useState<readonly string[]>([]);

  useEffect(() => {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    setDeviceLanguages(nav?.languages ?? (nav?.language ? [nav.language] : []));
  }, []);

  const stored = state.profile.locale;
  const explicit = isLocale(stored);
  const locale = resolveLocale(stored, deviceLanguages);

  const setLocale = useCallback(
    (next: Locale) => {
      updateProfile({ locale: next });
    },
    [updateProfile],
  );

  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, dir: localeDir(locale), t, setLocale, explicit, locales: LOCALES }),
    [locale, t, setLocale, explicit],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * The translator.
 *
 * Returns the English/device fallback outside a provider rather than throwing:
 * a public page that renders one shared component has no business crashing
 * because it is not inside the dashboard's provider tree.
 */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Convenience for the common case where only `t` is needed. */
export function useT(): Translator {
  return useContext(I18nContext).t;
}

/**
 * Native label for a locale — "Français", not "French" — because a language
 * picker that names languages in a language you cannot read is a puzzle.
 */
export function localeNativeLabel(id: Locale): string {
  return LOCALES.find((l) => l.id === id)?.native ?? id;
}
