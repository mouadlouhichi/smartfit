import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { listGymsServer } from '@/lib/tenant-server';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The gym directory — how a member finds a gym when nobody handed them a link.
 *
 * Server-rendered from the Admin SDK (the same public storefront data), so it
 * works for signed-out visitors and is indexable. Only live tenants are
 * listed: a directory entry that dead-ends on a "not open yet" page is a worse
 * experience than no entry.
 */
export const metadata: Metadata = {
  title: 'Find a gym',
  description:
    'Browse gyms on SmartFit — timetables, class booking and memberships, live on each gym’s own page.',
};

/**
 * Always render per request. A statically prerendered directory would bake the
 * tenant list at build time — in cloud mode a gym approved today would stay
 * invisible until the next deploy, which is exactly the wrong failure for a
 * directory whose job is discoverability.
 */
export const dynamic = 'force-dynamic';

export default async function GymsPage() {
  const gyms = await listGymsServer();

  return (
    <div className="mx-auto min-h-dvh max-w-4xl space-y-8 p-4 py-10 sm:p-6">
      <header className="space-y-3">
        <Link href="/" aria-label="SmartFit home">
          <Wordmark />
        </Link>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Find a gym</h1>
        <p className="text-muted-foreground max-w-xl">
          Every gym below runs on SmartFit — browse the timetable, book classes and manage your
          membership on their page. Trainers, groups and independent coaches welcome.
        </p>
      </header>

      {gyms.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            No gyms are listed yet. If you run one,{' '}
            <Link href="/" className="underline underline-offset-4">
              come back soon
            </Link>{' '}
            — self-serve applications are on the way.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {gyms.map((gym) => (
            <Card key={gym.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold tracking-tight">{gym.name}</p>
                    {gym.location?.city && (
                      <p className="text-muted-foreground flex items-center gap-1 text-sm">
                        <MapPin className="size-3.5" />
                        {[gym.location.city, gym.location.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className="mt-1 size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: gym.branding?.accentColor || '#8ad200' }}
                  />
                </div>
                {gym.branding?.tagline && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {gym.branding.tagline}
                  </p>
                )}
                <Button asChild className="mt-auto w-full">
                  <Link href={`/g/${gym.slug}`}>
                    Visit {gym.name} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <footer className="text-muted-foreground border-border/60 border-t pt-4 text-xs">
        Gyms get their own address like <code className="font-mono">zone-fight.smartfit.app</code> —
        every page is also reachable at{' '}
        <code className="font-mono">smartfit.app/g/&#123;gym&#125;</code>.
      </footer>
    </div>
  );
}
