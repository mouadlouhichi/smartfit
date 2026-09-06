'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/lib/store-context';

export default function LoginPage() {
  const router = useRouter();
  const { state, updateProfile } = useStore();
  const [name, setName] = useState(state.profile.name ?? '');

  function continueLocal(e: React.FormEvent) {
    e.preventDefault();
    updateProfile({ name: name.trim() || 'Athlete', onboardingDone: true });
    router.replace('/dashboard');
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Wordmark />
      </Link>
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SmartFit is local-first. Your training already lives on this device — just pick up where you left off.
          </p>
          <form onSubmit={continueLocal} className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="l-name">Your name</Label>
              <Input id="l-name" placeholder="Alex" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> No password, no server, no tracking.
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/onboarding" className="font-medium text-primary hover:underline">
          Set up your plan
        </Link>
      </p>
    </div>
  );
}
