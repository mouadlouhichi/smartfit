'use client';

import { useState } from 'react';
import { contrastRatio, type GymTenant } from '@smartfit/core';
import { safeImageUrl } from '@/lib/gym-profile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function BrandImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // Tenant-hosted assets are deliberately not fetched through Next's server image optimizer.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** Shared by the live storefront and editor, so the preview cannot drift from the published hero. */
export function StorefrontHero({
  gym,
  preview = false,
}: {
  gym: Pick<GymTenant, 'name' | 'slug' | 'branding'>;
  preview?: boolean;
}) {
  const accent = /^#[0-9a-f]{6}$/i.test(gym.branding?.accentColor ?? '')
    ? gym.branding!.accentColor!
    : '#8ad200';
  const foreground =
    contrastRatio(accent, '#ffffff') > contrastRatio(accent, '#000000') ? '#ffffff' : '#000000';
  const cover = safeImageUrl(gym.branding?.coverUrl);
  const logo = safeImageUrl(gym.branding?.logoUrl);
  return (
    <header
      className="overflow-hidden rounded-3xl"
      style={{ backgroundColor: accent, color: foreground }}
    >
      {cover && (
        <BrandImage
          key={cover}
          src={cover}
          alt=""
          className={cn('w-full object-cover', preview ? 'max-h-40' : 'max-h-80')}
        />
      )}
      <div className={preview ? 'p-6' : 'p-8 sm:p-12'}>
        {logo && (
          <BrandImage
            key={logo}
            src={logo}
            alt={`${gym.name} logo`}
            className="mb-4 size-16 rounded-2xl bg-white object-contain p-1"
          />
        )}
        <p className="text-xs font-bold tracking-widest break-all uppercase opacity-80">
          /g/{gym.slug}
        </p>
        <h1
          className={cn(
            'mt-2 font-black tracking-tight break-words',
            preview ? 'text-3xl' : 'text-4xl sm:text-5xl',
          )}
        >
          {gym.name || 'Your gym name'}
        </h1>
        {gym.branding?.tagline && (
          <p className="mt-3 max-w-xl text-lg font-medium break-words">{gym.branding.tagline}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {preview ? (
            <>
              <span className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                See pricing
              </span>
              <span className="rounded-full border border-current px-4 py-2 text-sm font-semibold">
                View timetable
              </span>
            </>
          ) : (
            <>
              <Button asChild className="bg-black text-white hover:bg-black/85">
                <a href={`/g/${gym.slug}/#pricing`}>See pricing</a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-current bg-transparent hover:bg-black/10"
              >
                <a href={`/g/${gym.slug}/#timetable`}>View timetable</a>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
