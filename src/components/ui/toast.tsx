'use client';

import * as React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

type ToastTone = 'success' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = React.createContext<((message: string, tone?: ToastTone) => void) | null>(
  null,
);

/**
 * App-wide transient feedback ("Week imported — 4 sessions scheduled").
 * Floating pill, bottom-center above the mobile nav / bottom-left safe zone
 * on desktop so it never covers the global CTA or the coach composer.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="bg-charcoal animate-toast-in flex max-w-full items-center gap-2.5 rounded-3xl px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xl shadow-black/25 sm:rounded-full sm:pr-5 sm:pl-3.5 sm:text-left"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="text-primary h-4.5 w-4.5 shrink-0" aria-hidden />
            ) : (
              <Info className="h-4.5 w-4.5 shrink-0 text-white/70" aria-hidden />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string, tone?: ToastTone) => void {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
