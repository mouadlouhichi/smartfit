'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Without this, a single throw in a client screen
 * (a malformed persisted record, a chart edge case) white-screens the app.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[smartfit] route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="bg-destructive/10 text-destructive flex h-14 w-14 items-center justify-center rounded-2xl">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        This screen failed to render. Your training data is safe — it&apos;s stored separately from
        the page. Try again, and if it keeps happening you can export a backup from Profile.
      </p>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">Reference: {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="rounded-full">
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
