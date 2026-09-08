'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/report';

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
  useEffect(() => {
    console.error('[smartfit] fatal error:', error);
    // No-op unless the deployment configures a self-hosted collector.
    reportError('global', error, { digest: error.digest });
  }, [error]);

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
          background: '#efedea',
          color: '#171615',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          SmartFit couldn&apos;t start
        </h1>
        <p style={{ maxWidth: '28rem', color: '#57534e', margin: 0 }}>
          An unexpected error stopped the app from loading. Your training data is stored on this
          device and has not been touched.
        </p>
        <button
          onClick={reset}
          style={{
            border: 0,
            borderRadius: 999,
            padding: '0.65rem 1.4rem',
            background: '#e05e36',
            color: '#fff',
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
