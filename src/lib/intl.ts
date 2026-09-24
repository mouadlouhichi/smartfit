/**
 * `Intl` tag for the interface locale — `fr-FR` / `en-GB`, never the device's.
 *
 * Core's `intlLocale` deliberately leaves the English side to the device, which
 * is right for *data* that should follow the reader. The interface is different:
 * its dates were designed against British English, and a device set to `en-US`
 * reorders `26 Sep` into `Sep 26`. Pinning the region keeps the layout we drew.
 */
import type { Locale } from '@smartfit/core';

export const intlTag = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'en-GB');
