'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { buildDiagnostic, collectorUrl, reportDiagnostic } from '@/lib/report';

/**
 * Global crash listeners + web vitals.
 *
 * Both are complete no-ops unless the deployment configures
 * `NEXT_PUBLIC_ERROR_ENDPOINT` (a self-hosted, cookie-free collector), so the
 * default build sends nothing anywhere and the privacy policy stays true.
 */
export function Telemetry() {
  useEffect(() => {
    if (!collectorUrl()) return;

    function onError(e: ErrorEvent) {
      // ResizeObserver loop warnings are benign, universal browser noise.
      if (typeof e.message === 'string' && e.message.includes('ResizeObserver')) return;
      reportDiagnostic(buildDiagnostic('window.error', e.error ?? e.message));
    }
    function onRejection(e: PromiseRejectionEvent) {
      reportDiagnostic(buildDiagnostic('unhandledrejection', e.reason));
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useReportWebVitals((metric) => {
    if (!collectorUrl()) return;
    reportDiagnostic({
      scope: 'vital',
      message: `${metric.name}=${Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)}`,
      ts: Date.now(),
      extra: { name: metric.name, value: metric.value, rating: metric.rating, id: metric.id },
    });
  });

  return null;
}
