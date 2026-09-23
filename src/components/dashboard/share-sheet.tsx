'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Loader2, Share2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import {
  copyPng,
  renderRunCard,
  renderRouteSticker,
  shareOrDownload,
  type RunCardData,
  type ShareFormat,
  type ShareStyle,
} from '@/lib/share-card';
import { cn } from '@/lib/utils';

const STYLES: { id: ShareStyle; label: string; hint: string }[] = [
  { id: 'transparent', label: 'Transparent', hint: 'Layers over a photo — story style' },
  { id: 'dark', label: 'Volt', hint: 'Dark card, route on a real night map' },
  { id: 'light', label: 'Ink', hint: 'Light card, route on a street map' },
];

const FORMATS: { id: ShareFormat; label: string; ratio: string }[] = [
  { id: 'square', label: 'Post', ratio: '4:5' },
  { id: 'story', label: 'Story', ratio: '9:16' },
];

/**
 * Callers hand the sheet a fresh object on every render, so identity is useless
 * as a memo key. Compare the fields instead (the route by reference): the
 * preview must not re-render the whole canvas when an unrelated parent state
 * update happens — e.g. a live GPS tick behind the sheet.
 */
function sameCard(a: RunCardData, b: RunCardData): boolean {
  return (
    a.title === b.title &&
    a.dateLabel === b.dateLabel &&
    a.distanceKm === b.distanceKm &&
    a.movingSec === b.movingSec &&
    a.paceMinPerKm === b.paceMinPerKm &&
    a.elevationGainM === b.elevationGainM &&
    a.calories === b.calories &&
    a.watermark === b.watermark &&
    a.route === b.route &&
    a.splits === b.splits &&
    a.efforts === b.efforts &&
    a.achievements === b.achievements
  );
}

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  /** Everything the card needs; the sheet renders it live. */
  data: Omit<RunCardData, 'watermark'>;
  /** false = Pro: renders without the "made with" line. */
  watermark: boolean;
  filename: string;
  /** When set, a "route only" transparent sticker is offered too. */
  routeAvailable?: boolean;
}

/**
 * The share sheet — one place for every shareable image.
 *
 * Mirrors what athletes expect from Strava's share screen: a live preview, the
 * transparent "layers over your photo" option, post vs. story framing, and the
 * three ways out (OS share sheet, download, copy to clipboard). Free cards
 * carry the "made with SmartFit" line; Pro keeps the mark alone.
 */
export function ShareSheet({
  open,
  onClose,
  data,
  watermark,
  filename,
  routeAvailable = false,
}: ShareSheetProps) {
  const toast = useToast();
  const [style, setStyle] = useState<ShareStyle>('transparent');
  const [format, setFormat] = useState<ShareFormat>('square');
  const [withStats, setWithStats] = useState(true);
  const [withRoute, setWithRoute] = useState(true);
  const [busy, setBusy] = useState<'share' | 'download' | 'copy' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const cardRef = useRef<RunCardData | null>(null);
  const nextCard = useMemo<RunCardData>(() => ({ ...data, watermark }), [data, watermark]);
  if (!cardRef.current || !sameCard(cardRef.current, nextCard)) cardRef.current = nextCard;
  const cardData = cardRef.current;

  const render = useCallback(async () => {
    if (routeAvailable && !withStats && withRoute) {
      return renderRouteSticker(cardData.route ?? [], {
        format,
        watermark,
        title: cardData.title,
        subtitle: `${Math.round(cardData.distanceKm * 100) / 100} km · ${fmtPace(cardData.paceMinPerKm)} /km`,
      });
    }
    return renderRunCard(cardData, { style, format, stats: withStats, route: withRoute });
  }, [cardData, format, style, withStats, withRoute, routeAvailable, watermark]);

  // Render (and re-render) the preview whenever an option changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreviewing(true);
    void render()
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast('Could not render the image', 'info');
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, render]);

  // Release the object URL when the sheet closes or unmounts.
  useEffect(() => {
    if (open) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreviewUrl(null);
    blobRef.current = null;
  }, [open]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function run(action: 'share' | 'download' | 'copy') {
    const blob = blobRef.current;
    if (!blob) return;
    setBusy(action);
    try {
      if (action === 'share') {
        const result = await shareOrDownload(blob, filename, `${data.title} · SmartFit`);
        toast(result === 'shared' ? 'Shared' : 'Image saved to downloads');
      } else if (action === 'download') {
        await shareOrDownload(blob, filename, `${data.title} · SmartFit`);
        toast('Image saved to downloads');
      } else {
        const ok = await copyPng(blob);
        toast(
          ok ? 'Image copied — paste it anywhere' : 'Copying images is not supported here',
          ok ? undefined : 'info',
        );
      }
    } catch {
      toast('Could not share the image', 'info');
    } finally {
      setBusy(null);
    }
  }

  const transparent = style === 'transparent' && withStats;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share your run</DialogTitle>
          <DialogDescription>
            Pick a style, then send it straight to Instagram, Strava, Messages or your camera roll.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          {/* ── Live preview ─────────────────────────────────────────── */}
          <div className="grid gap-2">
            <div
              className={cn(
                'relative flex items-center justify-center overflow-hidden rounded-2xl border p-3',
                format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]',
                transparent
                  ? // The transparency checkerboard uses the *current* field and
                    // card tokens — it was pinned to the old palette, so changing
                    // a token silently left the backdrop off-brand.
                    'bg-[repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)] bg-[length:18px_18px]'
                  : 'bg-secondary',
              )}
            >
              {previewUrl ? (
                // The card is already an image; plain <img> keeps the exact pixels.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Share card preview"
                  className={cn(
                    'max-h-full max-w-full rounded-xl object-contain',
                    previewing && 'opacity-60',
                  )}
                />
              ) : (
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
              )}
              {previewing && previewUrl && (
                <span className="bg-background/80 text-foreground absolute right-4 bottom-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Rendering
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-center text-[11px]">
              {transparent
                ? 'Transparent PNG — drop it on a photo in your story editor.'
                : format === 'story'
                  ? '9:16 — fills a story frame.'
                  : '4:5 — sized for the feed.'}
            </p>
          </div>

          {/* ── Options ──────────────────────────────────────────────── */}
          <div className="grid content-start gap-4">
            <fieldset className="grid gap-2">
              <legend className="text-foreground/90 text-sm font-medium">Style</legend>
              <div className="grid gap-2">
                {STYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStyle(option.id)}
                    aria-pressed={style === option.id}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors',
                      style === option.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/60',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        option.id === 'transparent' &&
                          'bg-[repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)] bg-[length:12px_12px]',
                        option.id === 'dark' && 'bg-[#050404]',
                        option.id === 'light' && 'bg-[#edebe6]',
                      )}
                    >
                      {style === option.id && (
                        <Check
                          className={cn(
                            'h-4 w-4',
                            option.id === 'light' ? 'text-foreground' : 'text-white',
                          )}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm font-bold">
                        {option.label}
                      </span>
                      <span className="text-muted-foreground block text-xs">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-2">
              <p className="text-foreground/90 text-sm font-medium">Frame</p>
              <div className="bg-secondary flex gap-1 rounded-full p-1">
                {FORMATS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFormat(option.id)}
                    aria-pressed={format === option.id}
                    className={cn(
                      'flex-1 rounded-full px-3 py-2 text-xs font-bold transition-colors',
                      format === option.id
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {option.label} · {option.ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-border grid gap-3 rounded-2xl border p-3.5">
              <label className="flex items-center justify-between gap-3 text-sm font-medium">
                Include stats
                <Switch checked={withStats} onCheckedChange={setWithStats} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm font-medium">
                Include route
                <Switch
                  checked={withRoute}
                  onCheckedChange={setWithRoute}
                  disabled={!routeAvailable && !data.route}
                />
              </label>
              {watermark && (
                <p className="text-muted-foreground flex items-start gap-1.5 text-[11px]">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  Free cards carry a small &ldquo;made with SmartFit&rdquo; line + logo. Pro removes
                  the line — the logo always stays.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void run('copy')}
              disabled={!previewUrl || busy !== null}
            >
              {busy === 'copy' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void run('download')}
              disabled={!previewUrl || busy !== null}
            >
              {busy === 'download' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              Save
            </Button>
            <Button
              type="button"
              onClick={() => void run('share')}
              disabled={!previewUrl || busy !== null}
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden />
              )}
              Share
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmtPace(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  // Rounding 5.999 minutes must read 6:00, never the impossible 5:00.
  return `${s === 60 ? m + 1 : m}:${String(s === 60 ? 0 : s).padStart(2, '0')}`;
}
