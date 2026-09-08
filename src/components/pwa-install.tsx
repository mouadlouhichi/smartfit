'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Minimal, polite PWA install affordance.
 *
 * The manifest and service worker make SmartFit installable, but browsers
 * hide that behind a menu — most people never find it. This captures
 * `beforeinstallprompt` (Chromium/Android) and offers a one-tap install
 * inside the app. It never nags: one dismiss hides it for good on this
 * device, and it stays hidden once the app runs standalone or iOS Safari
 * (which fires no such event) is in use.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'smartfit.install.dismissed';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Already installed / running as an installed PWA.
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage unavailable — still fine to offer once per session */
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  async function install() {
    try {
      await deferred!.prompt();
      const { outcome } = await deferred!.userChoice;
      if (outcome === 'accepted') dismiss();
      else setDeferred(null); // keep the card; the user may change their mind
    } catch {
      dismiss(); // prompt failed (already installed, gesture expired) — go away
    }
  }

  function dismiss() {
    setVisible(false);
    setDeferred(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bg-card border-border fixed right-4 bottom-24 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl lg:bottom-6">
      <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
        <Download className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Install SmartFit</p>
        <p className="text-muted-foreground text-xs">Add to your home screen for one-tap access.</p>
      </div>
      <Button size="sm" onClick={install} className="shrink-0 rounded-full">
        Install
      </Button>
      <button
        onClick={dismiss}
        aria-label="Don't offer to install again"
        className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded-full p-1.5 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
