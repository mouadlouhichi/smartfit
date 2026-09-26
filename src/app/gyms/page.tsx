import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { listGymsServer } from '@/lib/tenant-server';
import { Wordmark } from '@/components/brand';
import { ApplyCard } from '@/components/tenant/apply-card';
import { Button } from '@/components/ui/button';
import { GymCardMedia } from '@/components/tenant/brand-media';
import { WorkspaceIllustration } from '@/components/ui/artwork';
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
  // The directory degrades to its empty state rather than 500-ing when the
  // platform data layer fails: members can still reach a gym via its own
  // link, and the operator sees the real error in the server log.
  let gyms: Awaited<ReturnType<typeof listGymsServer>> = [];
  let listFailed = false;
  try {
    gyms = await listGymsServer();
  } catch (err) {
    console.error('[gyms-directory] could not list gyms:', err);
    listFailed = true;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl space-y-8 p-4 py-10 sm:p-6">
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

      {listFailed ? (
        <Card>
          <CardContent className="p-6 text-sm">
            <p className="font-bold">We couldn&rsquo;t load the gym list</p>
            <p className="text-muted-foreground mt-1">
              This looks like a problem on our side, not an empty platform — try again in a moment.
              Operators: the server log line starting{' '}
              <code className="bg-muted rounded px-1">[gyms-directory]</code> has the cause.
            </p>
          </CardContent>
        </Card>
      ) : gyms.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            <WorkspaceIllustration className="mx-auto" />
            No gyms are listed yet — be the first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym) => (
            <Card
              key={gym.id}
              className="group flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
            >
              <GymCardMedia gym={gym} />
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
                    style={{ backgroundColor: gym.branding?.accentColor || 'var(--volt)' }}
                  />
                </div>
                {gym.branding?.tagline && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {gym.branding.tagline}
                  </p>
                )}
                {!!gym.branding?.amenities?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {gym.branding.amenities.slice(0, 3).map((a) => (
                      <span
                        key={a}
                        className="bg-secondary rounded-full px-2 py-1 text-[10px] font-medium"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
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

      <ApplyCard />

      <footer className="text-muted-foreground border-border/60 flex flex-wrap justify-between gap-3 border-t pt-4 text-xs">
        <span>
          Gyms get their own address like <code className="font-mono">zone-fight.smartfit.app</code>{' '}
          — every page is also reachable at{' '}
          <code className="font-mono">smartfit.app/g/&#123;gym&#125;</code>.
        </span>
        <a href="/admin" className="hover:text-foreground underline underline-offset-4">
          Platform admin
        </a>
      </footer>
    </div>
  );
}
