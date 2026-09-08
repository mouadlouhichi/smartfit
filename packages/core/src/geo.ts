/**
 * GPS / route maths for the walk tracker.
 *
 * Pure and unit-tested: distance uses haversine on the WGS-84 sphere, routes
 * are simplified by even-index sampling so a long walk stores a bounded number
 * of points, and bounds/scale helpers feed both the SVG preview and the
 * transparent share-canvas.
 */

import type { GeoPoint } from './types';

export type { GeoPoint };

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two fixes, in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Total route length in kilometres. */
export function routeDistanceKm(points: GeoPoint[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversineMeters(points[i - 1], points[i]);
  return m / 1000;
}

/** Latitude/longitude bounding box of a route. */
export function routeBounds(points: GeoPoint[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Even-stride sampling down to `max` points, always keeping the first and last
 * fix so the drawn route starts and ends where you did.
 */
export function simplifyRoute(points: GeoPoint[], max = 500): GeoPoint[] {
  if (points.length <= max) return points;
  const stride = (points.length - 1) / (max - 1);
  const out: GeoPoint[] = [];
  for (let i = 0; i < max - 1; i++) out.push(points[Math.round(i * stride)]);
  out.push(points[points.length - 1]);
  return out;
}

/** Walking pace as minutes per km; 0 when there is no distance. */
export function paceMinPerKm(durationMin: number, km: number): number {
  if (km <= 0) return 0;
  return durationMin / km;
}

/** `7.5` min/km → "7:30 /km". */
export function formatPace(minPerKm: number): string {
  if (minPerKm <= 0) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/**
 * Project a route into a square pixel box, preserving aspect ratio and
 * inverting latitude so north is up. Returns the polyline plus the projected
 * start/end points, ready for SVG or canvas.
 */
export function projectRoute(
  points: GeoPoint[],
  size: number,
  padding: number,
): {
  line: { x: number; y: number }[];
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const b = routeBounds(points);
  const inner = size - padding * 2;
  // Scale latitude by cos(midLat) so east-west metres match north-south.
  const latScale = Math.cos(toRad((b.minLat + b.maxLat) / 2));
  const w = Math.max(1e-9, (b.maxLng - b.minLng) * latScale);
  const h = Math.max(1e-9, b.maxLat - b.minLat);
  const scale = inner / Math.max(w, h);

  const cx = (b.minLng + b.maxLng) / 2;
  const cy = (b.minLat + b.maxLat) / 2;

  const project = (p: GeoPoint) => ({
    x: size / 2 + (p.lng - cx) * latScale * scale,
    y: size / 2 - (p.lat - cy) * scale,
  });

  const line = points.map(project);
  return { line, start: line[0], end: line[line.length - 1] };
}
