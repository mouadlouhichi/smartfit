'use client';
import { ArrowUpRight, ArrowDown, MoveUpRight } from 'lucide-react';
import type { GymTenant } from '@smartfit/core';
import { gymCover, safeImageUrl } from '@/lib/gym-profile';
import { Artwork } from '@/components/ui/artwork';
import { Button } from '@/components/ui/button';
import { GymLogo, brandColors } from './brand-media';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import { OrbitArtwork, useHeroParallax } from './storefront-motion';

/** One component for both the owner's draft preview and the published gym page. */
export function StorefrontHero({
  gym,
  preview = false,
}: {
  gym: Pick<GymTenant, 'name' | 'slug' | 'branding'>;
  preview?: boolean;
}) {
  const { accent, foreground } = brandColors(gym);
  const motionRef = useHeroParallax(preview);
  const layout = gym.branding?.heroLayout ?? 'split';
  const label = gym.branding?.ctaLabel?.trim() || 'See pricing';
  const content = (
    <div
      className={cn(
        'relative z-10 flex flex-col items-start justify-center',
        preview ? 'p-6' : 'px-6 py-10 @min-[600px]:p-12 @min-[1000px]:p-16',
        layout === 'banner' && 'max-w-3xl',
      )}
    >
      <div className="mb-7 flex items-center gap-3">
        <GymLogo
          gym={gym}
          className={cn('border-white/20', preview ? 'size-12 text-sm' : 'size-14 text-lg')}
        />
        <span className="max-w-44 text-[10px] font-semibold tracking-[.22em] text-white/65 uppercase">
          Your place.
          <br />
          Your pace.
        </span>
      </div>
      <h1
        className={cn(
          'max-w-full leading-[0.98] font-black tracking-[-0.045em] break-words',
          preview ? 'text-4xl' : 'text-5xl @min-[600px]:text-6xl @min-[1000px]:text-7xl',
        )}
      >
        {gym.name || 'Your gym name'}
        <span aria-hidden="true" style={{ color: accent }}>
          .
        </span>
      </h1>
      <p
        className={cn(
          'mt-6 max-w-md leading-relaxed text-white/75',
          preview ? 'text-sm' : 'text-base @min-[600px]:text-lg',
        )}
      >
        {gym.branding?.tagline || 'Find your next session. Build your own rhythm.'}
      </p>
      {!!gym.branding?.amenities?.length && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Gym amenities">
          {gym.branding.amenities.map((amenity) => (
            <li
              key={amenity}
              className="rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-[10px] text-white/85"
            >
              {amenity}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {preview ? (
          <>
            <span
              className="rounded-full px-5 py-3 text-xs font-semibold"
              style={{ backgroundColor: accent, color: foreground }}
            >
              {label} ↗
            </span>
            <span className="rounded-full border border-white/30 px-5 py-3 text-xs font-semibold">
              View timetable
            </span>
          </>
        ) : (
          <>
            <Button
              asChild
              className="h-12 px-6"
              style={{ backgroundColor: accent, color: foreground }}
            >
              <a href={`/g/${gym.slug}/#pricing`}>
                {label}
                <ArrowUpRight className="size-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 border-white/30 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
            >
              <a href={`/g/${gym.slug}/#timetable`}>
                View timetable
                <ArrowDown className="size-4" />
              </a>
            </Button>
          </>
        )}
      </div>
      <div className="mt-10 flex items-center gap-3 text-[9px] font-medium tracking-[.18em] text-white/45 uppercase">
        <span className="h-px w-8" style={{ backgroundColor: accent }} />
        Start where you are. Go further.
      </div>
    </div>
  );
  const image = (
    <div
      className={cn(
        'sf-hero-photo overflow-hidden',
        layout === 'banner'
          ? 'absolute inset-0'
          : 'relative h-full min-h-64 @min-[600px]:min-h-[480px]',
      )}
    >
      <Artwork
        src={gymCover(gym.branding)}
        eager={!preview}
        className="sf-parallax-cover absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: gym.branding?.coverPosition ?? 'center' }}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          layout === 'banner'
            ? 'bg-gradient-to-r from-black/85 via-black/60 to-black/20'
            : 'bg-gradient-to-t from-black/60 via-transparent to-black/10',
        )}
      />
      {layout === 'split' && (
        <div
          aria-hidden="true"
          className="sf-hero-compass absolute top-5 right-5 flex size-12 items-center justify-center rounded-full border border-white/35 text-white"
        >
          <MoveUpRight className="size-5" />
        </div>
      )}
      {!safeImageUrl(gym.branding?.coverUrl) && (
        <span className="absolute right-4 bottom-4 rounded-full bg-black/65 px-3 py-1 text-[9px] text-white/80">
          Illustrative artwork · SmartFit
        </span>
      )}
    </div>
  );
  return (
    <header
      ref={motionRef}
      data-motion-scene
      data-preview={preview || undefined}
      style={{ '--gym-accent': accent, '--gym-foreground': foreground } as CSSProperties}
      className={cn(
        'sf-hero @container relative isolate overflow-hidden rounded-[2rem] bg-zinc-950 text-white',
        layout === 'banner' && !preview && 'min-h-[540px]',
      )}
    >
      {layout === 'banner' && image}
      <div className="sf-hero-atmosphere" aria-hidden="true">
        <div className="sf-hero-glow" />
        <div className="sf-hero-grid" />
        <OrbitArtwork />
      </div>
      <div
        className={cn('relative', layout === 'split' && 'grid @min-[600px]:grid-cols-[1fr_1fr]')}
      >
        {content}
        {layout === 'split' && image}
        {layout === 'minimal' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 -z-10 size-96 translate-x-1/3 -translate-y-1/4 rounded-full border-[60px] opacity-15"
            style={{ borderColor: accent }}
          />
        )}
      </div>
    </header>
  );
}
