'use client';

/**
 * The share-image engine.
 *
 * Every card SmartFit renders goes through here, so they all carry the same
 * brand furniture (the bolt mark + the SmartFit wordmark), the same type
 * scale and the same rules. Three output styles:
 *
 *  - `transparent` — no background at all: the Strava-style story share. The
 *    route, stats and logo are drawn on alpha 0 so they layer over a photo,
 *    every glyph carries a dark halo so it survives a bright image, and the
 *    route gets a shadow glow instead of a panel.
 *  - `dark` — the volt stage (deep charcoal, warm radial glow).
 *  - `light` — warm paper, for feeds on white timelines.
 *
 * Layout is computed, not hard-coded: blocks reserve their height, the route
 * takes what is left (within bounds) and optional blocks drop out when the
 * card is too small for them — so square and story cards both look composed.
 *
 * Free cards keep the "made with SmartFit" line; Pro keeps the mark alone
 * (branding, never a nag).
 */

import { drawMapTiles, mapPoint, MAP_ATTRIBUTION, type MapTransform } from './map-tiles';
import { fmtDuration, fmtPace, projectRoute, type GeoPoint } from '@smartfit/core';
import { FLAME_PATH, FLAME_STROKE, VOLT, VOLT_INK } from '@/lib/brand-mark';

export type ShareStyle = 'transparent' | 'dark' | 'light';
export type ShareFormat = 'square' | 'story';

interface ShareTheme {
  /** null = never paint a background (transparent output). */
  bg: string | null;
  ink: string;
  inkSoft: string;
  accent: string;
  highlight: string;
  panel: string | null;
  panelBorder: string;
  route: string;
  routeGlow: string;
  /** Dark halo behind text/route on transparent cards. */
  halo: string | null;
  equalizerOff: string;
}

const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

const THEMES: Record<ShareStyle, ShareTheme> = {
  transparent: {
    bg: null,
    ink: '#ffffff',
    inkSoft: 'rgba(255,255,255,0.85)',
    accent: '#8AD200',
    highlight: '#8AD200',
    panel: null,
    panelBorder: 'rgba(255,255,255,0.30)',
    route: '#ffffff',
    routeGlow: 'rgba(10,8,7,0.55)',
    halo: 'rgba(10,8,7,0.72)',
    equalizerOff: 'rgba(255,255,255,0.38)',
  },
  dark: {
    bg: '#050404',
    ink: '#edebe6',
    inkSoft: 'rgba(237,235,230,0.66)',
    accent: '#8AD200',
    highlight: '#8AD200',
    panel: 'rgba(255,255,255,0.06)',
    panelBorder: 'rgba(255,255,255,0.13)',
    route: '#8AD200',
    routeGlow: 'rgba(138,210,0,0.55)',
    halo: null,
    equalizerOff: 'rgba(237,235,230,0.22)',
  },
  light: {
    bg: '#edebe6',
    ink: '#131313',
    inkSoft: 'rgba(19,19,19,0.62)',
    accent: '#a8b80f',
    highlight: '#a8b80f',
    panel: '#ffffff',
    panelBorder: 'rgba(19,19,19,0.08)',
    route: '#a8b80f',
    routeGlow: 'rgba(138,210,0,0.30)',
    halo: null,
    equalizerOff: 'rgba(19,19,19,0.16)',
  },
};

export function shareTheme(style: ShareStyle): ShareTheme {
  return THEMES[style];
}

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

const font = (weight: number, size: number, family: string = FONT) =>
  `${weight} ${size}px ${family}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ── primitives ──────────────────────────────────────────────────────── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: ShareTheme,
  radius = 44,
) {
  if (!theme.panel) return;
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.panelBorder;
  ctx.stroke();
  ctx.restore();
}

interface TextOpts {
  theme: ShareTheme;
  size: number;
  weight?: number;
  ink?: string;
  align?: CanvasTextAlign;
  /** Letter-spacing for eyebrow labels (canvas has no tracking property). */
  tracking?: number;
  mono?: boolean;
}

/** Text with the theme's halo (transparent cards) or plain ink. */
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, opts: TextOpts) {
  const { theme, size, weight = 700, ink, align = 'left', tracking = 0 } = opts;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(weight, size, opts.mono ? MONO : FONT);

  const drawn = tracking > 0 ? track(ctx, value, tracking) : value;
  const width = ctx.measureText(drawn).width;
  const originX = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;

  if (theme.halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(6, size * 0.18);
    ctx.strokeStyle = theme.halo;
    ctx.strokeText(drawn, originX, y);
  }
  ctx.fillStyle = ink ?? theme.ink;
  ctx.fillText(drawn, originX, y);
  ctx.restore();
  return width;
}

/**
 * Canvas has no tracking property in older browsers: set `letterSpacing` when
 * it exists, otherwise widen the string with thin spaces so eyebrow labels
 * still read as designed.
 */
function track(ctx: CanvasRenderingContext2D, value: string, amount: number): string {
  if (amount <= 0 || value.length < 2) return value;
  const ctxWithSpacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in ctxWithSpacing) {
    ctxWithSpacing.letterSpacing = `${ctx.measureText(' ').width * amount}px`;
    return value;
  }
  return value.split('').join('\u2009');
}

/** Fit a string inside `maxWidth` by truncating with an ellipsis. */
function fit(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  size: number,
  weight = 800,
): string {
  ctx.save();
  ctx.font = font(weight, size);
  let out = value;
  while (out.length > 3 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  ctx.restore();
  return out === value ? value : `${out}…`;
}

/* ── brand furniture ─────────────────────────────────────────────────── */

/**
 * The SmartFit mark: the volt charge cell with the near-black bolt — the same
 * badge the dashboard header wears, and the geometry of `public/icon.svg`. Drawn as
 * vectors so there is no image decode, no CORS and no softness at any size.
 */
export function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opts: { plate?: string; ink?: string; halo?: boolean } = {},
) {
  ctx.save();
  if (opts.halo) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = size * 0.22;
  }
  // Rounded-square charge cell (arcTo keeps canvas compatibility — roundRect
  // is not available in older Safari).
  const r = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + size, y, x + size, y + size, r);
  ctx.arcTo(x + size, y + size, x, y + size, r);
  ctx.arcTo(x, y + size, x, y, r);
  ctx.arcTo(x, y, x + size, y, r);
  ctx.closePath();
  ctx.fillStyle = opts.plate ?? VOLT;
  ctx.fill();
  ctx.restore();

  // The flame, in the mark's own 24-box coordinates — stroked, exactly as
  // Lucide draws it (see FLAME_STROKE in lib/brand-mark.ts).
  const s = (size * 0.6) / 24;
  ctx.save();
  ctx.translate(x + (size - 24 * s) / 2, y + (size - 24 * s) / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = opts.ink ?? VOLT_INK;
  ctx.lineWidth = FLAME_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(FLAME_PATH));
  ctx.restore();
}

/** "Smart" + volt "Fit" wordmark; `x`/`y` are the left baseline. */
export function drawWordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  theme: ShareTheme,
): { width: number } {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(800, size);
  const headWidth = ctx.measureText('Smart').width;
  const tailWidth = ctx.measureText('Fit').width;
  ctx.restore();

  text(ctx, 'Smart', x, y, { theme, size, weight: 800 });
  if (theme.halo) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(800, size);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(6, size * 0.18);
    ctx.strokeStyle = theme.halo;
    ctx.strokeText('Fit', x + headWidth, y);
    ctx.restore();
  }
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(800, size);
  ctx.fillStyle = theme.accent;
  ctx.fillText('Fit', x + headWidth, y);
  ctx.restore();

  return { width: headWidth + tailWidth };
}

/** Mark + wordmark: the brand lockup used in card headers and footers. */
function drawLockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  markSize: number,
  theme: ShareTheme,
  opts: { halo?: boolean } = {},
): number {
  drawLogoMark(ctx, x, y, markSize, { halo: opts.halo });
  const { width } = drawWordmark(
    ctx,
    x + markSize + 26,
    y + markSize * 0.74,
    markSize * 0.72,
    theme,
  );
  return markSize + 26 + width;
}

/* ── route + splits ──────────────────────────────────────────────────── */

/** Project a route into a square box and stroke it with glow + gradient. */
export function drawRoute(
  ctx: CanvasRenderingContext2D,
  route: GeoPoint[],
  box: { x: number; y: number; size: number },
  theme: ShareTheme,
  opts: { lineWidth?: number } = {},
) {
  const { line, start, end } = projectRoute(route, box.size, box.size * 0.085);
  const points = line.map((p) => ({ x: p.x + box.x, y: p.y + box.y }));
  const path = new Path2D();
  points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));

  const width = opts.lineWidth ?? Math.max(10, box.size * 0.03);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = theme.routeGlow;
  ctx.lineWidth = width * 2.2;
  if (theme.halo) {
    ctx.shadowColor = theme.routeGlow;
    ctx.shadowBlur = width * 2;
  }
  ctx.stroke(path);

  const grad = ctx.createLinearGradient(
    points[0].x,
    points[0].y,
    points.at(-1)!.x,
    points.at(-1)!.y,
  );
  grad.addColorStop(0, theme.route);
  grad.addColorStop(1, theme.accent);
  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.shadowBlur = 0;
  ctx.stroke(path);
  ctx.restore();

  const r = width * 0.75;
  endpointDot(ctx, start.x + box.x, start.y + box.y, r, '#ffffff', theme.route, theme);
  endpointDot(ctx, end.x + box.x, end.y + box.y, r, theme.highlight, '#050404', theme);
}

/** Rounded-rectangle clip path, used to frame the basemap like a panel. */
function roundPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The route in true map registration: same projection as the tiles under it,
 * so the line sits on the streets it was recorded on — the whole point of
 * drawing a basemap at all.
 */
function drawRouteOnMap(
  ctx: CanvasRenderingContext2D,
  route: GeoPoint[],
  t: MapTransform,
  theme: ShareTheme,
  opts: { lineWidth?: number },
) {
  const points = route.map((p) => mapPoint(t, p));
  const path = new Path2D();
  points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  const width = opts.lineWidth ?? 12;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = theme.routeGlow;
  ctx.lineWidth = width * 2.2;
  ctx.stroke(path);

  const grad = ctx.createLinearGradient(
    points[0].x,
    points[0].y,
    points.at(-1)!.x,
    points.at(-1)!.y,
  );
  grad.addColorStop(0, theme.route);
  grad.addColorStop(1, theme.accent);
  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();

  const r = width * 0.75;
  endpointDot(ctx, points[0].x, points[0].y, r, '#ffffff', theme.route, theme);
  endpointDot(ctx, points.at(-1)!.x, points.at(-1)!.y, r, theme.highlight, '#050404', theme);
}

function endpointDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  ring: string,
  theme: ShareTheme,
) {
  ctx.save();
  if (theme.halo) {
    ctx.shadowColor = theme.halo;
    ctx.shadowBlur = r;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/**
 * Splits as a pace equalizer: one bar per kilometre, taller = faster, with the
 * fastest bar highlighted and partial splits dimmed.
 */
export function drawSplitBars(
  ctx: CanvasRenderingContext2D,
  splits: { paceMinPerKm: number; partial?: boolean }[],
  box: { x: number; y: number; w: number; h: number },
  theme: ShareTheme,
) {
  if (splits.length === 0) return;
  const paced = splits.filter((s) => s.paceMinPerKm > 0);
  if (paced.length === 0) return;
  const best = Math.min(...paced.map((s) => s.paceMinPerKm));
  const slowest = Math.max(...paced.map((s) => s.paceMinPerKm));
  const span = Math.max(1e-6, slowest - best);
  const gap = Math.min(16, box.w * 0.02);
  const barW = (box.w - gap * (splits.length - 1)) / splits.length;
  const bestIndex = splits.findIndex((s) => s.paceMinPerKm === best);

  splits.forEach((split, i) => {
    const t = split.paceMinPerKm > 0 ? 1 - (split.paceMinPerKm - best) / span : 0.4;
    const h = box.h * (0.45 + 0.55 * Math.max(0, Math.min(1, t)));
    const x = box.x + i * (barW + gap);
    ctx.save();
    roundRect(ctx, x, box.y + (box.h - h), Math.max(6, barW), h, Math.min(12, barW / 2));
    ctx.fillStyle = split.partial
      ? theme.equalizerOff
      : i === bestIndex
        ? theme.highlight
        : theme.route;
    ctx.fill();
    ctx.restore();
  });
}

/* ── the card ────────────────────────────────────────────────────────── */

export interface RunCardData {
  title: string;
  dateLabel: string;
  distanceKm: number;
  /** Moving time in seconds (auto-pause excluded). */
  movingSec: number;
  paceMinPerKm: number;
  elevationGainM: number;
  calories?: number;
  splits?: { paceMinPerKm: number; partial?: boolean }[];
  efforts?: { label: string; durationSec: number }[];
  achievements?: { label: string; detail: string }[];
  route?: GeoPoint[];
  /** false = Pro (mark only, no "made with" line). */
  watermark?: boolean;
}

export interface RunCardOptions {
  /**
   * Draw a real basemap (CARTO/OSM raster tiles) under the route on the
   * opaque styles — the Strava look. Off, or offline, keeps the plain panel.
   * The transparent style never fetches tiles: transparency is the point.
   */
  map?: boolean;
  style?: ShareStyle;
  format?: ShareFormat;
  /** Draw the route (off for a stats-only card). */
  route?: boolean;
  /** Draw stats (off for a route-only transparent sticker). */
  stats?: boolean;
}

/**
 * Render a run card. Square (1080×1350, feed) or story (1080×1920), in any of
 * the three styles. Blocks that do not fit simply drop out, so a short run and
 * a marathon both produce a composed image.
 */
export async function renderRunCard(data: RunCardData, opts: RunCardOptions = {}): Promise<Blob> {
  const style = opts.style ?? 'dark';
  const format = opts.format ?? 'square';
  const wantRoute = opts.route ?? true;
  const wantStats = opts.stats ?? true;
  const theme = shareTheme(style);
  const { w: W, h: H } = SHARE_SIZES[format];

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  const pad = format === 'story' ? 96 : 84;
  const topPad = format === 'story' ? 190 : 92;
  const bottomReserved = 190;
  const available = H - topPad - bottomReserved - pad;

  // ── background stage ─────────────────────────────────────────────────
  if (theme.bg) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    if (style === 'dark') {
      const glow = ctx.createRadialGradient(W / 2, H * 0.2, 30, W / 2, H * 0.2, W * 0.9);
      glow.addColorStop(0, 'rgba(138,210,0,0.42)');
      glow.addColorStop(1, 'rgba(138,210,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    } else {
      const wash = ctx.createLinearGradient(0, 0, W, H);
      wash.addColorStop(0, 'rgba(138,210,0,0.10)');
      wash.addColorStop(1, 'rgba(138,210,0,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── header ───────────────────────────────────────────────────────────
  const markSize = format === 'story' ? 104 : 92;
  drawLogoMark(ctx, pad, topPad, markSize, { halo: style === 'transparent' });
  drawWordmark(ctx, pad + markSize + 26, topPad + markSize * 0.74, markSize * 0.72, theme);
  text(ctx, data.dateLabel.toUpperCase(), W - pad, topPad + markSize * 0.34, {
    theme,
    size: 28,
    weight: 800,
    ink: theme.inkSoft,
    align: 'right',
  });
  text(ctx, fit(ctx, data.title.toUpperCase(), W * 0.45, 32), W - pad, topPad + markSize * 0.78, {
    theme,
    size: 32,
    weight: 800,
    ink: theme.accent,
    align: 'right',
  });

  let y = topPad + markSize + 64;

  // ── headline: distance + unit, then the stat row ─────────────────────
  const splits = data.splits ?? [];
  const achievements = data.achievements ?? [];
  const efforts = data.efforts ?? [];
  const badgeBlock = wantStats ? achievements.length * 56 + efforts.length * 56 + 24 : 0;
  const splitsBlock = wantStats && splits.length > 1 ? 250 : 0;
  const statsBlock = wantStats ? 420 : 0;

  const routeBudget = available - statsBlock - badgeBlock - splitsBlock;
  const hasRoute = wantRoute && (data.route?.length ?? 0) >= 2;
  const routeSize = hasRoute
    ? Math.max(300, Math.min(wantStats ? W - pad * 2 : W, routeBudget))
    : 0;

  if (wantStats) {
    const distance = round2(data.distanceKm);
    const distanceText = `${distance}`;
    ctx.save();
    ctx.font = font(800, format === 'story' ? 230 : 200);
    const distanceWidth = ctx.measureText(distanceText).width;
    ctx.restore();
    text(ctx, distanceText, pad, y + (format === 'story' ? 190 : 168), {
      theme,
      size: format === 'story' ? 230 : 200,
      weight: 800,
      mono: false,
    });
    text(ctx, 'KM', pad + distanceWidth + 20, y + (format === 'story' ? 190 : 168), {
      theme,
      size: 68,
      weight: 800,
      ink: theme.highlight,
    });
    y += format === 'story' ? 244 : 222;

    const cells: [string, string][] = [
      ['TIME', fmtDuration(data.movingSec)],
      ['PACE', `${fmtPace(data.paceMinPerKm)}`],
      ['ELEV', `${Math.round(data.elevationGainM)} m`],
    ];
    const cellW = (W - pad * 2) / cells.length;
    cells.forEach(([label, value], i) => {
      const x = pad + i * cellW;
      text(ctx, label, x, y, { theme, size: 25, weight: 800, ink: theme.inkSoft, tracking: 1.4 });
      text(ctx, value, x, y + 64, { theme, size: 56, weight: 800, mono: true });
    });
    y += 108;
  }

  // ── route, over a real basemap when we can fetch one ─────────────────
  if (hasRoute && routeSize > 0) {
    const x = (W - routeSize) / 2;
    const mapRect = { x: x - 28, y: y - 28, w: routeSize + 56, h: routeSize + 56 };
    const lineWidth = Math.max(12, routeSize * 0.026);
    let transform: MapTransform | null = null;

    if (style !== 'transparent' && opts.map !== false) {
      ctx.save();
      roundPath(ctx, mapRect.x, mapRect.y, mapRect.w, mapRect.h, 56);
      ctx.clip();
      transform = await drawMapTiles(
        ctx,
        data.route!,
        mapRect,
        style === 'dark' ? 'dark' : 'light',
      );
      if (transform) {
        // Settle the map into the card instead of letting it shout.
        ctx.fillStyle = style === 'dark' ? 'rgba(20,17,16,0.30)' : 'rgba(239,237,234,0.22)';
        ctx.fillRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);
      }
      ctx.restore();
    }

    if (transform) {
      drawRouteOnMap(ctx, data.route!, transform, theme, { lineWidth });
      text(ctx, MAP_ATTRIBUTION, mapRect.x + mapRect.w - 22, mapRect.y + mapRect.h - 20, {
        theme,
        size: 17,
        weight: 600,
        ink: style === 'dark' ? 'rgba(237,235,230,0.6)' : 'rgba(23,22,21,0.6)',
        align: 'right',
      });
    } else {
      if (theme.panel) {
        panel(ctx, mapRect.x, mapRect.y, mapRect.w, mapRect.h, theme, 56);
      }
      drawRoute(ctx, data.route!, { x, y, size: routeSize }, theme, { lineWidth });
    }
    y += routeSize + (transform || theme.panel ? 44 : 16);
  }

  // ── splits equalizer ─────────────────────────────────────────────────
  if (wantStats && splits.length > 1) {
    const fast = splits.reduce((a, b) => (a.paceMinPerKm <= b.paceMinPerKm ? a : b));
    const slow = splits.reduce((a, b) => (a.paceMinPerKm >= b.paceMinPerKm ? a : b));
    if (theme.panel) panel(ctx, pad - 28, y - 26, W - pad * 2 + 56, 232, theme, 52);
    text(ctx, 'SPLITS / KM', pad, y + 26, {
      theme,
      size: 25,
      weight: 800,
      ink: theme.inkSoft,
      tracking: 1.4,
    });
    text(ctx, `${fmtPace(fast.paceMinPerKm)} – ${fmtPace(slow.paceMinPerKm)}`, W - pad, y + 26, {
      theme,
      size: 25,
      weight: 800,
      ink: theme.inkSoft,
      align: 'right',
    });
    drawSplitBars(ctx, splits, { x: pad, y: y + 52, w: W - pad * 2, h: 120 }, theme);
    y += 232;
  }

  // ── records + best efforts ───────────────────────────────────────────
  if (wantStats) {
    for (const item of achievements.slice(0, 3)) {
      text(ctx, `★ ${item.label}`, pad, y + 34, {
        theme,
        size: 32,
        weight: 800,
        ink: theme.highlight,
      });
      text(ctx, item.detail, W - pad, y + 34, { theme, size: 32, weight: 800, align: 'right' });
      y += 56;
    }
    for (const effort of efforts.slice(0, 3)) {
      text(ctx, `${effort.label} best`, pad, y + 34, {
        theme,
        size: 32,
        weight: 700,
        ink: theme.inkSoft,
      });
      text(ctx, fmtDuration(effort.durationSec), W - pad, y + 34, {
        theme,
        size: 32,
        weight: 800,
        align: 'right',
        mono: true,
      });
      y += 56;
    }
  }

  // ── footer: brand rule, lockup and the watermark line ────────────────
  const footerY = H - pad * 0.8;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pad, footerY - 104);
  ctx.lineTo(W - pad, footerY - 104);
  ctx.strokeStyle = theme.panelBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  drawLockup(ctx, pad, footerY - 70, 54, theme, { halo: style === 'transparent' });
  text(
    ctx,
    data.watermark === false ? 'SMARTFIT PRO' : 'made with SmartFit',
    W - pad,
    footerY - 30,
    {
      theme,
      size: 28,
      weight: data.watermark === false ? 800 : 600,
      ink: theme.inkSoft,
      align: 'right',
    },
  );

  return toPng(canvas);
}

/** Render the transparent route-only sticker (no stats) in one call. */
export async function renderRouteSticker(
  route: GeoPoint[],
  opts: { format?: ShareFormat; watermark?: boolean; title?: string; subtitle?: string } = {},
): Promise<Blob> {
  const format = opts.format ?? 'square';
  const theme = shareTheme('transparent');
  const { w: W, h: H } = SHARE_SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  const pad = 96;
  const size = Math.min(W - pad * 2, H - 620);
  drawRoute(ctx, route, { x: (W - size) / 2, y: (H - size) / 2 - 40, size }, theme, {
    lineWidth: Math.max(14, size * 0.03),
  });

  if (opts.title) {
    text(ctx, opts.title.toUpperCase(), W / 2, 190, {
      theme,
      size: 40,
      weight: 800,
      ink: theme.accent,
      align: 'center',
      tracking: 2,
    });
  }
  if (opts.subtitle) {
    text(ctx, opts.subtitle, W / 2, H - 210, {
      theme,
      size: 44,
      weight: 800,
      align: 'center',
    });
  }
  drawLockup(ctx, W / 2 - 150, H - 150, 52, theme, { halo: true });

  return toPng(canvas);
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
  );
}

/** Share through the OS sheet when files are supported, else download. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title = 'SmartFit',
): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (err) {
    // Dismissing the OS sheet is not an error worth surfacing.
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

/** Copy to the clipboard as an image (paste straight into a chat). */
export async function copyPng(blob: Blob): Promise<boolean> {
  try {
    const ClipboardItemCtor = (window as Window & { ClipboardItem?: typeof ClipboardItem })
      .ClipboardItem;
    if (!ClipboardItemCtor || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
