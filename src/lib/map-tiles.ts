/**
 * Slippy-map maths and tile fetching for the share canvas.
 *
 * The share card draws a *real* basemap under the route — the Strava look —
 * using public raster tiles (CARTO's render of OpenStreetMap data). Both
 * providers allow this with attribution and sensible volumes: a share card
 * fetches at most a dozen tiles, once, from the athlete's own browser.
 *
 * Everything geometric here is pure so it can be unit-tested without a DOM;
 * the only impure part is `fetchTile`, which is cached and CORS-clean so the
 * canvas never gets tainted (a tainted canvas cannot be exported to PNG).
 */

export const TILE_PX = 256;
/** Web mercator stops at ±85.05° — beyond that the projection is infinite. */
const MAX_LAT = 85.0511287798066;

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

export type MapKind = 'dark' | 'light';

/**
 * Public CARTO basemaps. `dark_all` is the near-black Strava-night look;
 * `voyager` is the warm light map closest to Strava's daytime one.
 * `@2x` gives 512 px tiles so a 1080 px card stays crisp.
 */
export function tileUrl(kind: MapKind, z: number, x: number, y: number): string {
  const style = kind === 'dark' ? 'dark_all' : 'rastertiles/voyager';
  const sub = 'abcd'[(x + y) % 4];
  return `https://${sub}.basemaps.cartocdn.com/${style}/${z}/${x}/${y}@2x.png`;
}

export interface MapBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface PxPoint {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Global pixel coordinates at zoom `z` (256 px tiles, origin top-left). */
export function project(lng: number, lat: number, z: number): PxPoint {
  const scale = TILE_PX * 2 ** z;
  const la = clamp(lat, -MAX_LAT, MAX_LAT);
  const sin = Math.sin((la * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Bounds of a route, padded by `pad` (fraction of the larger side). */
export function routeBounds(points: { lat: number; lng: number }[], pad = 0.12): MapBounds | null {
  if (points.length < 2) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  // An out-and-back on the same street still deserves a readable frame: the
  // box grows from its centre to at least a few streets across, then pads.
  const cLng = (minLng + maxLng) / 2;
  const cLat = (minLat + maxLat) / 2;
  const halfLng = Math.max((maxLng - minLng) / 2, 0.002) * (1 + pad);
  const halfLat = Math.max((maxLat - minLat) / 2, 0.002) * (1 + pad);
  return {
    minLng: cLng - halfLng,
    maxLng: cLng + halfLng,
    minLat: clamp(cLat - halfLat, -MAX_LAT, MAX_LAT),
    maxLat: clamp(cLat + halfLat, -MAX_LAT, MAX_LAT),
  };
}

/** The most detailed zoom at which the whole bounds fits `w`×`h` pixels. */
export function pickZoom(bounds: MapBounds, w: number, h: number, max = 17): number {
  for (let z = max; z >= 1; z--) {
    const a = project(bounds.minLng, bounds.maxLat, z); // top-left
    const b = project(bounds.maxLng, bounds.minLat, z); // bottom-right
    if (b.x - a.x <= w && b.y - a.y <= h) return z;
  }
  return 0;
}

export interface TileRange {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z: number;
}

export function tileRange(bounds: MapBounds, z: number): TileRange {
  const a = project(bounds.minLng, bounds.maxLat, z);
  const b = project(bounds.maxLng, bounds.minLat, z);
  const last = 2 ** z - 1;
  return {
    x0: clamp(Math.floor(a.x / TILE_PX), 0, last),
    x1: clamp(Math.floor(b.x / TILE_PX), 0, last),
    y0: clamp(Math.floor(a.y / TILE_PX), 0, last),
    y1: clamp(Math.floor(b.y / TILE_PX), 0, last),
    z,
  };
}

/* ── fetching ─────────────────────────────────────────────────────────── */

type TileImage = ImageBitmap | HTMLImageElement;
const cache = new Map<string, Promise<TileImage | null>>();

/** CORS-clean tile load, memoised — a re-render must not re-download. */
export function fetchTile(url: string): Promise<TileImage | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  const promise = (async (): Promise<TileImage | null> => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (typeof createImageBitmap === 'function') return await createImageBitmap(blob);
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await img.decode();
      return img;
    } catch {
      return null; // offline, blocked, or rate-limited — the card falls back
    }
  })();
  cache.set(url, promise);
  // Keep the cache from growing without bound during a long session.
  if (cache.size > 400) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return promise;
}

export interface MapTransform {
  z: number;
  /** Pixel offset that maps global tile-space onto the canvas rect. */
  offX: number;
  offY: number;
  range: TileRange;
}

/**
 * Draws the basemap for `points` into `rect` and returns the transform that
 * maps geographic points into the same rectangle, so the route can be drawn
 * on top perfectly registered. Returns null when tiles could not be fetched
 * (offline, blocked) and the caller should keep its plain background.
 */
export async function drawMapTiles(
  ctx: CanvasRenderingContext2D,
  points: { lat: number; lng: number }[],
  rect: { x: number; y: number; w: number; h: number },
  kind: MapKind,
): Promise<MapTransform | null> {
  const bounds = routeBounds(points);
  if (!bounds) return null;
  const z = pickZoom(bounds, rect.w, rect.h);
  const range = tileRange(bounds, z);
  const tileCount = (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1);
  if (tileCount > 24) return null; // something degenerate — refuse politely

  const urls: string[] = [];
  for (let tx = range.x0; tx <= range.x1; tx++) {
    for (let ty = range.y0; ty <= range.y1; ty++) urls.push(tileUrl(kind, z, tx, ty));
  }
  const images = await Promise.all(urls.map(fetchTile));
  if (images.some((img) => img === null)) return null;

  const top = project(bounds.minLng, bounds.maxLat, z);
  const bottom = project(bounds.maxLng, bounds.minLat, z);
  const offX = rect.x + (rect.w - (bottom.x - top.x)) / 2 - top.x;
  const offY = rect.y + (rect.h - (bottom.y - top.y)) / 2 - top.y;

  let i = 0;
  for (let tx = range.x0; tx <= range.x1; tx++) {
    for (let ty = range.y0; ty <= range.y1; ty++) {
      const img = images[i++];
      if (!img) continue;
      ctx.drawImage(img, offX + tx * TILE_PX, offY + ty * TILE_PX, TILE_PX, TILE_PX);
    }
  }
  return { z, offX, offY, range };
}

/** Geographic point → canvas pixels, using a transform from drawMapTiles. */
export function mapPoint(t: MapTransform, p: { lat: number; lng: number }): PxPoint {
  const g = project(p.lng, p.lat, t.z);
  return { x: g.x + t.offX, y: g.y + t.offY };
}
