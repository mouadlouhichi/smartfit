'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that makes SmartFit installable and lets the
 * app shell load offline. Development is deliberately excluded — a cached
 * shell fights hot reload.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* an unavailable SW must never break the app */
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
