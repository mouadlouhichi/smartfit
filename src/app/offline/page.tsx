import type { Metadata } from 'next';
import Link from 'next/link';
import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Wordmark />
      <span className="bg-secondary text-muted-foreground mt-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <CloudOff className="h-7 w-7" />
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        This page hasn&apos;t been cached yet. Anything you&apos;ve already logged is still on your
        device, and new sessions will sync as soon as you reconnect.
      </p>
      <Button asChild className="mt-2 rounded-full">
        <Link href="/dashboard">Back to the app</Link>
      </Button>
    </div>
  );
}
