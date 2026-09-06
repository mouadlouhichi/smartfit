import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Wordmark />
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="max-w-sm text-muted-foreground">
        This page took a rest day and never came back. Let&apos;s get you back to your training.
      </p>
      <Button asChild className="mt-2 rounded-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
