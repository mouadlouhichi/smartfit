import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock3, MapPin, UserRound, Users } from 'lucide-react';
import { isValidSlug } from '@smartfit/core';
import { loadTenantCached } from '@/lib/tenant-server';
import { SlotBookingActions } from '@/components/tenant/my-gym';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Class detail — one template, all its upcoming occurrences.
 *
 * The public timetable stays a dense overview; this page is where a prospect
 * lingers: what the class is, who teaches it, where it happens, and every
 * upcoming time with a live seat count and a book action. Server-rendered
 * like the storefront, so it is indexable on its own.
 */

const FOCUS_LABEL: Record<string, string> = {
  combat: 'Combat',
  hiit: 'HIIT',
  strength: 'Strength',
  cardio: 'Cardio',
  mind: 'Mind & recovery',
  aqua: 'Aqua',
};

const INTENSITY_LABEL: Record<string, string> = {
  low: 'Low intensity',
  moderate: 'Moderate intensity',
  high: 'High intensity',
};

function fmt(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; classId: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug, classId } = await params;
  const slug = decodeURIComponent(rawSlug ?? '');
  if (!isValidSlug(slug)) return { title: 'Class not found' };
  const { gym, classes } = await loadTenantCached(slug);
  const cls = classes.find((c) => c.id === classId);
  if (!gym || !cls) return { title: 'Class not found' };
  return {
    title: `${cls.name} at ${gym.name}`,
    description:
      cls.description ??
      `${cls.minutes}-minute ${FOCUS_LABEL[cls.focus] ?? cls.focus} class at ${gym.name}${cls.instructorName ? ` with ${cls.instructorName}` : ''}.`,
  };
}

export default async function ClassPage({
  params,
}: {
  params: Promise<{ slug: string; classId: string }>;
}) {
  const { slug: rawSlug, classId } = await params;
  const slug = decodeURIComponent(rawSlug ?? '');
  if (!isValidSlug(slug)) notFound();

  const { gym, classes, slots } = await loadTenantCached(slug);
  const cls = classes.find((c) => c.id === classId);
  if (!gym || !cls) notFound();

  const now = Date.now();
  const upcoming = slots
    .filter((s) => s.classId === cls.id && !s.cancelled && s.startsAt >= now)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 12);
  const accent = gym.branding?.accentColor || '#8ad200';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <Link
        href={`/g/${slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {gym.name}
      </Link>

      <header
        className="overflow-hidden rounded-3xl p-8 text-black"
        style={{ backgroundColor: accent }}
      >
        <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">
          {FOCUS_LABEL[cls.focus] ?? cls.focus} · {INTENSITY_LABEL[cls.intensity] ?? cls.intensity}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{cls.name}</h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium opacity-80">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-4" /> {cls.minutes} min
          </span>
          {cls.instructorName && (
            <span className="flex items-center gap-1.5">
              <UserRound className="size-4" /> {cls.instructorName}
            </span>
          )}
          {cls.studio && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {cls.studio}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="size-4" /> {cls.capacity} spots
          </span>
        </div>
      </header>

      {cls.description && <p className="leading-relaxed">{cls.description}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upcoming times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No times scheduled right now — check back soon.
            </p>
          ) : (
            upcoming.map((slot) => {
              const left = Math.max(0, slot.capacity - slot.booked);
              return (
                <div
                  key={slot.id}
                  className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-2 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">{fmt(slot.startsAt)}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {timeOfDay(slot.startsAt)}–{timeOfDay(slot.endsAt)} ·{' '}
                      {left === 0 ? 'Full' : `${left} of ${slot.capacity} spots left`}
                    </p>
                  </div>
                  <SlotBookingActions slot={slot} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Booked classes appear in “My classes” on the{' '}
        <Link href={`/g/${slug}`} className="underline underline-offset-4">
          gym page
        </Link>
        . Memberships are handled at the gym.
      </p>

      <div className="text-muted-foreground text-xs">
        <Badge variant="secondary" className="mr-2">
          {gym.name}
        </Badge>
        {[gym.location?.city, gym.location?.country].filter(Boolean).join(', ')}
      </div>
    </div>
  );
}
