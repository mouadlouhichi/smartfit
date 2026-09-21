'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/report';
import { isStaleDeploymentError, reloadForNewDeployment } from '@/lib/stale-deployment';

/**
 * Last-resort boundary: catches failures in the root layout itself, so it must
 * render its own <html>/<body> and cannot rely on app styles or providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A tab left open across a redeploy asks for chunk hashes the current
  // deployment no longer has — the fix is a fresh load, not a re-render, so
  // this heals itself once per session instead of showing a dead screen.
  const staleDeployment = isStaleDeploymentError(error);

  useEffect(() => {
    console.error('[smartfit] fatal error:', error);
    // No-op unless the deployment configures a self-hosted collector.
    reportError('global', error, { digest: error.digest });
    if (staleDeployment) reloadForNewDeployment();
  }, [error, staleDeployment]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: '#edebe6',
          color: '#131313',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {staleDeployment ? 'Updating SmartFit' : "SmartFit couldn't start"}
        </h1>
        <p style={{ maxWidth: '28rem', color: '#6f6f6f', margin: 0 }}>
          {staleDeployment ? (
            <>A new version was just released — reloading this page to pick it up…</>
          ) : (
            <>
              An unexpected error stopped the app from loading. Your training data is stored on this
              device and has not been touched.
            </>
          )}
        </p>
        <button
          onClick={() => (staleDeployment ? window.location.reload() : reset())}
          style={{
            border: 0,
            borderRadius: 999,
            padding: '0.65rem 1.4rem',
            background: '#8AD200',
            color: '#0d1102',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
