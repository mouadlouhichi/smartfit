'use client';

/**
 * Canvas renderers for the **workout receipt** card. Route cards moved to
 * `share-card.ts`, which owns every run share style (transparent, Ember,
 * Paper) and is reached through `ShareSheet`.
 */

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

export interface WorkoutCardStats {
  title: string;
  dateLabel: string;
  durationMin: number;
  sets: number;
  exercises: number;
  /** Tonnage in canonical kg (0 for distance-only sessions). */
  volume: number;
  volumeUnit: 'kg' | 'lb';
  /** Distance in km (0 for iron-only sessions). */
  distance: number;
  personalRecords: string[];
}

/**
 * Renders a 1080×1350 "gym receipt" card: session title, headline stat
 * (tonnage or distance), sets/volume/PR rows and a footer. Free shares carry
 * the SMARTFIT watermark; Pro renders it clean.
 */
export async function renderWorkoutPng(
  stats: WorkoutCardStats,
  opts: { watermark?: boolean } = {},
): Promise<Blob> {
  const { watermark = true } = opts;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  // ── ember stage ────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1d1512');
  bg.addColorStop(0.55, '#141110');
  bg.addColorStop(1, '#0f0c0b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 520);
  glow.addColorStop(0, 'rgba(224, 94, 54, 0.5)');
  glow.addColorStop(1, 'rgba(224, 94, 54, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const font = (w: number, s: number) => `${w} ${s}px "Plus Jakarta Sans", system-ui, sans-serif`;
  let y = 150;

  // Eyebrow + title.
  ctx.font = font(800, 40);
  ctx.fillStyle = '#f0a37f';
  ctx.fillText('SMARTFIT SESSION', 80, y);
  y += 96;
  ctx.font = font(800, 84);
  ctx.fillStyle = '#f7f2ea';
  ctx.fillText(truncate(ctx, stats.title.toUpperCase(), W - 160), 80, y);
  y += 56;
  ctx.font = font(600, 40);
  ctx.fillStyle = 'rgba(247,242,234,0.6)';
  ctx.fillText(`${stats.dateLabel}  ·  ${stats.durationMin} min`, 80, y);
  y += 110;

  // Headline stat: tonnage for iron, distance for cardio.
  const headline =
    stats.volume > 0
      ? `${formatCardVolume(stats.volume, stats.volumeUnit)}`
      : `${stats.distance < 1 ? `${Math.round(stats.distance * 1000)} m` : `${round1(stats.distance)} km`}`;
  const headlineSub = stats.volume > 0 ? 'TOTAL VOLUME' : 'TOTAL DISTANCE';
  ctx.font = font(800, 150);
  ctx.fillStyle = '#c8f135';
  ctx.fillText(headline, 80, y);
  y += 60;
  ctx.font = font(800, 36);
  ctx.fillStyle = 'rgba(200,241,53,0.75)';
  ctx.fillText(headlineSub, 82, y);
  y += 110;

  // Stat rows.
  ctx.font = font(700, 46);
  const rows: [string, string][] = [
    ['Sets', `${stats.sets}`],
    ['Exercises', `${stats.exercises}`],
    ['Duration', `${stats.durationMin} min`],
  ];
  for (const [label, val] of rows) {
    ctx.fillStyle = 'rgba(247,242,234,0.55)';
    ctx.fillText(label.toUpperCase(), 80, y);
    ctx.fillStyle = '#f7f2ea';
    ctx.textAlign = 'right';
    ctx.fillText(val, W - 80, y);
    ctx.textAlign = 'left';
    y += 78;
  }

  // PR callout.
  if (stats.personalRecords.length > 0) {
    y += 30;
    ctx.font = font(800, 44);
    ctx.fillStyle = '#f0c882';
    const prLine = `★ ${stats.personalRecords.length} PERSONAL RECORD${stats.personalRecords.length === 1 ? '' : 'S'}`;
    ctx.fillText(prLine, 80, y);
    y += 62;
    ctx.font = font(600, 40);
    ctx.fillStyle = 'rgba(247,242,234,0.85)';
    for (const pr of stats.personalRecords.slice(0, 4)) {
      ctx.fillText(truncate(ctx, `• ${pr}`, W - 160), 80, y);
      y += 58;
    }
  }

  // Footer.
  ctx.font = font(800, 38);
  ctx.textAlign = 'right';
  ctx.fillStyle = watermark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
  ctx.fillText(watermark ? 'MADE WITH SMARTFIT' : 'SMARTFIT PRO', W - 80, H - 70);
  ctx.restore();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
  );
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function formatCardVolume(kg: number, unit: 'kg' | 'lb'): string {
  const v = unit === 'lb' ? kg * 2.20462 : kg;
  const rounded = v >= 1000 ? Math.round(v).toLocaleString('en-US') : Math.round(v * 10) / 10;
  return `${rounded} ${unit === 'lb' ? 'lb' : 'kg'}`;
}
