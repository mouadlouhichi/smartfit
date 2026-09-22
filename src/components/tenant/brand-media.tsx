'use client';
import { useState } from 'react';
import { contrastRatio, type GymTenant } from '@smartfit/core';
import { gymCover, gymLogo, safeImageUrl } from '@/lib/gym-profile';
import { Artwork } from '@/components/ui/artwork';
import { cn } from '@/lib/utils';
type BrandGym = Pick<GymTenant, 'name' | 'branding'>;
export function brandColors(gym: BrandGym) {
  const accent = /^#[0-9a-f]{6}$/i.test(gym.branding?.accentColor ?? '')
    ? gym.branding!.accentColor!
    : '#8ad200';
  return {
    accent,
    foreground:
      contrastRatio(accent, '#ffffff') > contrastRatio(accent, '#000000') ? '#ffffff' : '#000000',
  };
}
export function GymLogo({ gym, className }: { gym: BrandGym; className?: string }) {
  const src = gymLogo(gym.branding);
  return <LogoBadge key={src ?? 'initials'} gym={gym} src={src} className={className} />;
}
function LogoBadge({ gym, src, className }: { gym: BrandGym; src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { accent, foreground } = brandColors(gym);
  const letters =
    gym.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => Array.from(w)[0])
      .join('')
      .toUpperCase() || 'GY';
  return (
    <div
      role="img"
      aria-label={`${gym.name} logo`}
      className={cn(
        'relative flex size-16 shrink-0 items-center justify-center overflow-hidden border border-black/5 text-xl font-black shadow-sm',
        gym.branding?.logoShape === 'circle'
          ? 'rounded-full'
          : gym.branding?.logoShape === 'square'
            ? 'rounded-none'
            : 'rounded-2xl',
        className,
      )}
      style={{ backgroundColor: src && !failed ? '#ffffff' : accent, color: foreground }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={256}
          height={256}
          className="h-full w-full object-contain p-2"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{letters}</span>
      )}
    </div>
  );
}
export function GymCardMedia({ gym }: { gym: BrandGym }) {
  return (
    <div className="relative mb-5">
      <div className="relative h-44 overflow-hidden rounded-t-2xl">
        <Artwork
          src={gymCover(gym.branding)}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          style={{ objectPosition: gym.branding?.coverPosition ?? 'center' }}
        />
        {!safeImageUrl(gym.branding?.coverUrl) && (
          <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white">
            SmartFit artwork
          </span>
        )}
      </div>
      <GymLogo gym={gym} className="absolute -bottom-5 left-5 ring-4 ring-[var(--card)]" />
    </div>
  );
}
export function GymGallery({ gym }: { gym: BrandGym }) {
  const urls = (gym.branding?.galleryUrls ?? []).map(safeImageUrl).filter((s): s is string => !!s);
  if (!urls.length) return null;
  return (
    <section className="space-y-3" aria-label="Gym photo gallery">
      <div>
        <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Take a look inside
        </p>
        <h2 className="mt-1 text-2xl font-bold">Your space to grow</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {urls.map((src, i) => (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-2xl border"
            key={`${i}-${src}`}
            aria-label={`Open ${gym.name} gallery image ${i + 1} in a new tab`}
          >
            <Artwork
              src={src}
              fallback=""
              alt={`${gym.name} gallery image ${i + 1}`}
              className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-105"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
