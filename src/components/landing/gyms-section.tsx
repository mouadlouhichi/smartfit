'use client';

import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { GymTenant } from '@smartfit/core';
import { gymGalleryImages } from '@/lib/gym-profile';
import { Artwork } from '@/components/ui/artwork';
import { useI18n } from '@/lib/i18n-context';

/**
 * The gyms running on SmartFit, on the marketing page.
 *
 * A visitor arriving at the landing page has no idea the product has a whole
 * tenant side — storefronts, timetables, bookings, a front desk. This section
 * is the door: real gyms, their own photographs, and their own addresses.
 *
 * Each card is a small mosaic (one wide image plus two squares) rather than a
 * single cover, because a directory entry made of one stock photo looks like a
 * placeholder. The images come from `gymGalleryImages`, which prefers what the
 * gym uploaded and otherwise draws its bundled set from the cover preset.
 *
 * It is a client component only because of the i18n context; the gym list is
 * fetched on the server and handed in as a prop, so the cards are in the HTML a
 * crawler receives.
 */
export function GymsSection({ gyms }: { gyms: GymTenant[] }) {
  const { t } = useI18n();
  if (gyms.length === 0) return null;
  const shown = gyms.slice(0, 3);

  return (
    <section id="gyms" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8">
          <div>
            <span className="eyebrow-mono mb-6">{t('landing.gyms.eyebrow')}</span>
            <h2 className="font-display text-4xl leading-[0.95] tracking-tight text-balance lg:text-6xl">
              {t('landing.gyms.title')}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--muted-foreground)]">
              {t('landing.gyms.body')}
            </p>
          </div>
          <Link
            href="/gyms"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]/80 transition-colors hover:text-[color:var(--foreground)]"
          >
            {t('landing.gyms.browse')}
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((gym) => {
            const images = gymGalleryImages(gym.branding, 3);
            const city = [gym.location?.city, gym.location?.country].filter(Boolean).join(', ');
            return (
              <article key={gym.id} className="group flex flex-col">
                <Link
                  href={`/g/${gym.slug}`}
                  className="hover-lift block overflow-hidden rounded-3xl border border-[color:var(--foreground)]/10"
                >
                  <div className="grid h-64 grid-cols-3 grid-rows-2 gap-px bg-[color:var(--foreground)]/10">
                    <div className="col-span-2 row-span-2 overflow-hidden">
                      <Artwork
                        src={images[0]}
                        alt={t('landing.gyms.altMain', { gym: gym.name })}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        style={{ objectPosition: gym.branding?.coverPosition ?? 'center' }}
                      />
                    </div>
                    {images.slice(1, 3).map((src, index) => (
                      <div key={`${src}-${index}`} className="overflow-hidden">
                        <Artwork
                          src={src}
                          alt={t('landing.gyms.altSpace', { gym: gym.name, index: index + 2 })}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                </Link>
                <div className="mt-5 flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-2xl tracking-tight">{gym.name}</h3>
                    <span
                      aria-hidden
                      className="mt-2 size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: gym.branding?.accentColor || 'var(--volt)' }}
                    />
                  </div>
                  {city && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-[color:var(--muted-foreground)]">
                      <MapPin className="size-3.5" />
                      {city}
                    </p>
                  )}
                  {(gym.branding?.tagline || gym.branding?.description) && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                      {gym.branding.tagline ?? gym.branding.description}
                    </p>
                  )}
                  {!!gym.branding?.amenities?.length && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {gym.branding.amenities.slice(0, 3).map((amenity) => (
                        <span
                          key={amenity}
                          className="rounded-full bg-[color:var(--foreground)]/5 px-2.5 py-1 font-mono text-[11px] text-[color:var(--muted-foreground)]"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/g/${gym.slug}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)] underline-offset-4 hover:underline"
                  >
                    {t('landing.gyms.view', { gym: gym.name })}
                    <ArrowUpRight className="size-4" />
                  </Link>
                  <p className="mt-2 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                    {t('landing.gyms.artworkNote')}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
