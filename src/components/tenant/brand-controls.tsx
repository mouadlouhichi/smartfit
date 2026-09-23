'use client';
import { useState } from 'react';
import { ImagePlus, Upload, Check, LayoutTemplate } from 'lucide-react';
import { GYM_AMENITIES, type GymBranding } from '@smartfit/core';
import { GYM_COVERS } from '@/lib/gym-profile';
import { importGymLogo } from '@/lib/logo-import';
import { Artwork } from '@/components/ui/artwork';
import { GymLogo } from './brand-media';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function BrandControls({
  value,
  name,
  onChange,
  onProcessingChange,
}: {
  value: GymBranding;
  name: string;
  onChange: (value: GymBranding) => void;
  onProcessingChange: (value: boolean) => void;
}) {
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  function update<K extends keyof GymBranding>(key: K, next: GymBranding[K]) {
    onChange({ ...value, [key]: next });
  }
  return (
    <div className="space-y-6 border-t pt-5">
      <section className="space-y-3" aria-label="Logo customization">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Upload className="size-4" /> Make it unmistakably yours
        </h3>
        <div className="bg-secondary/40 flex items-center gap-4 rounded-2xl border p-4">
          <GymLogo gym={{ name, branding: value }} className="size-20 text-2xl" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Your gym mark</p>
            <p className="text-muted-foreground mt-1 text-xs">
              No logo? We’ll create a monogram from your gym’s name.
            </p>
            {value.logoData && (
              <Button
                variant="link"
                size="sm"
                type="button"
                className="px-0"
                onClick={() => update('logoData', '')}
              >
                Remove uploaded logo
              </Button>
            )}
          </div>
        </div>
        <Field
          id="studio-logo-file"
          label="Upload logo"
          hint="PNG, JPEG or WebP · up to 4 MB. Optimized on your device to 256 px and ≤32 KB, then saved with your gym profile when you publish."
        >
          <Input
            id="studio-logo-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="file:bg-secondary h-auto rounded-xl py-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1 file:font-semibold"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setError('');
              setProcessing(true);
              onProcessingChange(true);
              try {
                update('logoData', await importGymLogo(file));
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not import this logo.');
              } finally {
                setProcessing(false);
                onProcessingChange(false);
              }
            }}
          />
        </Field>
        {processing && (
          <p role="status" className="text-sm">
            Optimizing your logo…
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Logo shape">
          {(['rounded', 'circle', 'square'] as const).map((shape) => (
            <button
              type="button"
              key={shape}
              aria-label={`${shape} logo`}
              aria-pressed={(value.logoShape ?? 'rounded') === shape}
              onClick={() => update('logoShape', shape)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs capitalize',
                value.logoShape === shape && 'border-primary bg-primary/10',
              )}
            >
              <span
                className={cn(
                  'size-5 bg-current opacity-40',
                  shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-md' : '',
                )}
              />
              {shape}
            </button>
          ))}
        </div>
        {value.logoData && (
          <p className="text-muted-foreground text-xs">
            Your uploaded logo takes priority over the logo URL above.
          </p>
        )}
      </section>
      <section className="space-y-3" aria-label="Storefront layout">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <LayoutTemplate className="size-4" /> Choose your first impression
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(['split', 'banner', 'minimal'] as const).map((layout) => (
            <button
              type="button"
              key={layout}
              aria-label={`${layout} hero layout`}
              aria-pressed={(value.heroLayout ?? 'split') === layout}
              onClick={() => update('heroLayout', layout)}
              className={cn(
                'space-y-2 rounded-xl border p-2 text-left text-xs capitalize',
                value.heroLayout === layout && 'border-primary bg-primary/10',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'bg-secondary flex h-16 overflow-hidden rounded-lg',
                  layout === 'banner' && 'flex-col-reverse',
                )}
              >
                <span className="flex flex-1 flex-col justify-center gap-1 p-2">
                  <span className="bg-foreground/60 h-1 w-3/4 rounded" />
                  <span className="bg-foreground/25 h-1 w-1/2 rounded" />
                  <span className="mt-1 h-2 w-6 rounded bg-lime-400" />
                </span>
                {layout !== 'minimal' && (
                  <span
                    className={cn(
                      'bg-gradient-to-br from-lime-300 to-emerald-900',
                      layout === 'banner' ? 'h-8' : 'w-1/2',
                    )}
                  />
                )}
              </span>
              <span className="block px-1 font-semibold">{layout}</span>
            </button>
          ))}
        </div>
        <Field
          id="studio-cta"
          label="Membership button label"
          hint="Always links to your membership pricing, not an external checkout."
        >
          <Input
            id="studio-cta"
            maxLength={32}
            placeholder="See pricing"
            value={value.ctaLabel ?? ''}
            onChange={(e) => update('ctaLabel', e.target.value)}
          />
        </Field>
      </section>
      <section className="space-y-3" aria-label="Cover artwork">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <ImagePlus className="size-4" /> Set the atmosphere
        </h3>
        <p className="text-muted-foreground text-xs">
          Original SmartFit artwork—not photos of your gym. Select a cover below or use your own
          HTTPS cover URL above.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {GYM_COVERS.map((cover) => (
            <button
              key={cover.id}
              type="button"
              aria-label={`Use ${cover.label} cover`}
              aria-pressed={!value.coverUrl && (value.coverPreset ?? 'strength') === cover.id}
              onClick={() => onChange({ ...value, coverPreset: cover.id, coverUrl: '' })}
              className={cn(
                'group overflow-hidden rounded-xl border text-left',
                !value.coverUrl && value.coverPreset === cover.id && 'ring-primary ring-2',
              )}
            >
              <div className="relative">
                <Artwork
                  src={cover.src}
                  className="aspect-[16/10] w-full transition-transform group-hover:scale-105"
                />
                {!value.coverUrl && value.coverPreset === cover.id && (
                  <span className="absolute top-2 right-2 rounded-full bg-lime-300 p-1 text-black">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <span className="block p-2 text-xs font-semibold">{cover.label}</span>
            </button>
          ))}
        </div>
        <Field id="studio-cover-position" label="Cover crop focus">
          <Select
            value={value.coverPosition ?? 'center'}
            onChange={(e) =>
              update('coverPosition', e.target.value as GymBranding['coverPosition'])
            }
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </Select>
        </Field>
      </section>
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold">What makes your gym special?</legend>
        <p className="text-muted-foreground text-xs">
          Only select amenities actually available at your gym.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {GYM_AMENITIES.map((a) => (
            /* Chip-style Checkbox: the tile is the click target and the box
               carries the state, so tapping "Parking" still labels itself. */
            <label
              key={a}
              className={cn(
                'border-input bg-field flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                value.amenities?.includes(a) && 'border-primary bg-primary/5',
              )}
            >
              <Checkbox
                checked={value.amenities?.includes(a) ?? false}
                onChange={(e) =>
                  update(
                    'amenities',
                    e.target.checked
                      ? [...(value.amenities ?? []), a]
                      : (value.amenities ?? []).filter((v) => v !== a),
                  )
                }
              />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
      <section className="space-y-3" aria-label="Gallery customization">
        <h3 className="text-sm font-bold">Show members around</h3>
        <p className="text-muted-foreground text-xs">
          Add up to three photos you own or have permission to use. They appear below your gym
          introduction.
        </p>
        {[0, 1, 2].map((i) => (
          <Field key={i} id={`studio-gallery-${i}`} label={`Gallery photo ${i + 1} (HTTPS)`}>
            <Input
              id={`studio-gallery-${i}`}
              type="url"
              placeholder="https://…"
              maxLength={2048}
              value={value.galleryUrls?.[i] ?? ''}
              onChange={(e) => {
                const urls = [0, 1, 2].map((j) => value.galleryUrls?.[j] ?? '');
                urls[i] = e.target.value;
                update('galleryUrls', urls);
              }}
            />
          </Field>
        ))}
      </section>
    </div>
  );
}
