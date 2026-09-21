'use client';

/**
 * "Your gym" — the member's link to the real gym tenants.
 *
 * The personal "custom gyms" builder this replaces is retired from the UI:
 * gyms in SmartFit are real businesses now (`/g/{slug}`), with live
 * timetables, bookings and memberships. This card picks one of them, stores
 * the tenant slug on the profile, and the Plan screen builds the suggested
 * week from that gym's real classes.
 *
 * The list comes from the server (`loadGymPrograms` → every live tenant);
 * only the selected slug is persisted, in the member's own profile.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { GymProgram } from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function GymPicker({
  programs,
  onLoad,
}: {
  /** Loaded gym list; empty until the first fetch resolves. */
  programs: GymProgram[];
  /** Called once with the server-loaded list (the Plan screen owns the state). */
  onLoad: (programs: GymProgram[]) => void;
}) {
  const { state, updateProfile } = useStore();
  const selected = state.profile.gymId ?? '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gym-programs')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load gyms (${res.status})`);
        return (await res.json()) as { gyms: GymProgram[] };
      })
      .then((data) => {
        if (!cancelled) onLoad(data.gyms ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the gym list. Check your connection.');
      });
    return () => {
      cancelled = true;
    };
  }, [onLoad]);

  const chosen = programs.find((g) => g.id === selected) ?? null;

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">Your gym</p>
            <p className="text-muted-foreground text-xs">
              Gyms running on SmartFit — pick one to build your week from its real timetable.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild className="rounded-full">
            <Link href="/gyms">
              Browse gyms <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {error && <p className="text-destructive text-xs">{error}</p>}

        {programs.length === 0 && !error && (
          <p className="text-muted-foreground text-sm">
            {selected ? 'Loading your gym…' : 'No gyms are listed yet — nothing to pick for now.'}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {programs.map((g) => {
            const active = g.id === selected;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={active}
                onClick={() => updateProfile({ gymId: g.id })}
                className={cn(
                  'focus-visible:ring-ring flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  active
                    ? 'border-primary bg-volt/[0.06]'
                    : 'border-border bg-card hover:border-volt/40',
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {active && <Check className="text-primary h-4 w-4" aria-hidden />}
                    {g.name}
                  </span>
                  {g.hours && (
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {g.hours}
                    </span>
                  )}
                </span>
                {active && (
                  <Link
                    href={`/g/${g.id}`}
                    className="text-primary text-xs font-semibold whitespace-nowrap hover:underline"
                  >
                    Open page
                  </Link>
                )}
              </button>
            );
          })}
        </div>

        {chosen && (
          <p className="text-muted-foreground text-xs">
            Book classes, see your membership and door visits on{' '}
            <Link href={`/g/${chosen.id}`} className="text-primary font-semibold hover:underline">
              {chosen.name}&rsquo;s page
            </Link>
            . Switch or clear your gym any time — your training data is yours.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
