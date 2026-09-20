'use client';

import { useEffect } from 'react';

/**
 * Hides the static launch splash that `RootLayout` paints into the SSR HTML
 * (see the `#app-splash` markup there).
 *
 * The splash exists for the installed-app launch path: a home-screen tap
 * otherwise stares at a blank webview while the bundle downloads and hydrates.
 * It is pure HTML+inline CSS so it paints on the very first frame, is scoped
 * to `display-mode: standalone` so browser tabs never see an interstitial,
 * and mirrors the manifest's `background_color` so the OS splash hands over
 * to it without a flash.
 *
 * It is hidden by class, never removed: the node is part of React's tree, so
 * detaching it from outside would make a later reconciliation die with
 * "removeChild: node is not a child". `visibility:hidden` takes it out of
 * paint, hit-testing and the a11y tree just as well.
 */
export function DismissAppSplash() {
  useEffect(() => {
    document.getElementById('app-splash')?.classList.add('splash-hide');
  }, []);

  return null;
}
