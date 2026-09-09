'use client';

import { formatPace, projectRoute, routeDistanceKm, type GeoPoint } from '@smartfit/core';

export interface RouteStats {
  title?: string;
  durationMin: number;
  /** When absent it is derived from the route. */
  distanceKm?: number;
}

/**
 * Renders a Strava-style route card as a **transparent** 1080×1080 PNG —
 * made to be layered over a photo or dropped into an Instagram story.
 *
 * The canvas is never filled with a background, so every pixel outside the
 * stroked route, endpoint dots and (optional) outlined stats stays at alpha 0.
 * The stats text is drawn with a dark outline so it survives being overlaid on
 * either light or dark imagery.
 */
export async function renderRoutePng(
  route: GeoPoint[],
  stats: RouteStats,
  opts: { includeStats?: boolean } = {},
): Promise<Blob> {
  const { includeStats = true } = opts;
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  // Leave room for stats at the bottom when they are drawn.
  const padding = includeStats ? 150 : 110;
  const { line, start, end } = projectRoute(route, size, padding);

  // ── glow underlay ────────────────────────────────────────────────────
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(224, 94, 54, 0.35)';
  ctx.lineWidth = 30;
  ctx.shadowColor = 'rgba(224, 94, 54, 0.6)';
  ctx.shadowBlur = 28;
  strokePath(ctx, line);
  ctx.restore();

  // ── main gradient stroke ─────────────────────────────────────────────
  const grad = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  grad.addColorStop(0, '#f0a37f');
  grad.addColorStop(0.5, '#e05e36');
  grad.addColorStop(1, '#c8f135');
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = grad;
  ctx.lineWidth = 16;
  strokePath(ctx, line);
  ctx.restore();

  // ── endpoints ────────────────────────────────────────────────────────
  dot(ctx, start, '#ffffff', '#e05e36'); // start: white core, ember ring
  dot(ctx, end, '#c8f135', '#141110'); // finish: volt core, dark ring

  // ── stats ────────────────────────────────────────────────────────────
  if (includeStats) {
    const km = stats.distanceKm ?? routeDistanceKm(route);
    const pace = formatPace(stats.durationMin / Math.max(km, 0.01));
    drawStats(ctx, size, stats.title ?? 'Walk', km, stats.durationMin, pace);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
  );
}

function strokePath(ctx: CanvasRenderingContext2D, line: { x: number; y: number }[]) {
  ctx.beginPath();
  line.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

function dot(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  fill: string,
  ring: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** Outlined, high-contrast stats block along the bottom of the card. */
function drawStats(
  ctx: CanvasRenderingContext2D,
  size: number,
  title: string,
  km: number,
  durationMin: number,
  pace: string,
) {
  const x = 70;
  const baseY = size - 150;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  // Title (small, volt).
  ctx.font = '700 44px "Plus Jakarta Sans", system-ui, sans-serif';
  outlineText(ctx, title.toUpperCase(), x, baseY, '#c8f135');

  // Big distance.
  ctx.font = '800 110px "Plus Jakarta Sans", system-ui, sans-serif';
  outlineText(ctx, `${round1(km)} km`, x, baseY + 110, '#ffffff');

  // Time · pace.
  ctx.font = '700 46px "Plus Jakarta Sans", system-ui, sans-serif';
  outlineText(ctx, `${Math.round(durationMin)} min  ·  ${pace}`, x, baseY + 180, '#f0a37f');

  // Watermark, bottom-right.
  ctx.font = '800 40px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'right';
  outlineText(ctx, 'SMARTFIT', size - 70, baseY + 180, 'rgba(255,255,255,0.9)');
  ctx.restore();
}

/** Fill text with a dark halo so it reads over any photo it is layered on. */
function outlineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
) {
  ctx.strokeStyle = 'rgba(10, 8, 7, 0.85)';
  ctx.lineWidth = 10;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

const round1 = (n: number) => Math.round(n * 100) / 100;

/**
 * Share the PNG through the OS share sheet (Instagram, Messages, …) when the
 * browser supports file sharing; otherwise fall back to a download.
 * Returns what happened so callers can toast it.
 */
export async function shareOrDownloadPng(
  blob: Blob,
  filename: string,
): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'SmartFit route' });
      return 'shared';
    }
  } catch (err) {
    // The user dismissing the share sheet is not an error worth surfacing.
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
