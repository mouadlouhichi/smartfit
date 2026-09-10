import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_ATTRIBUTION,
  pickZoom,
  project,
  routeBounds,
  tileRange,
  tileUrl,
  mapPoint,
  TILE_PX,
  type MapBounds,
} from '../src/lib/map-tiles.ts';

/**
 * The share canvas draws real basemap tiles, so the mercator maths under it
 * has to be exactly right: a route drawn one pixel off its own streets is
 * worse than no map at all. These tests pin the geometry without a DOM.
 */

const CASABLANCA = { lng: -7.5898, lat: 33.5731 };
const RABAT = { lng: -6.8498, lat: 34.0209 };

test('project() matches the slippy-map definition at the origin', () => {
  const p = project(0, 0, 0);
  assert.equal(Math.round(p.x), 128);
  assert.equal(Math.round(p.y), 128);
  const q = project(0, 0, 1);
  assert.equal(Math.round(q.x), 256);
  assert.equal(Math.round(q.y), 256);
});

test('project() doubles scale per zoom and orders north above south', () => {
  const z8 = project(CASABLANCA.lng, CASABLANCA.lat, 8);
  const z9 = project(CASABLANCA.lng, CASABLANCA.lat, 9);
  assert.ok(Math.abs(z9.x - z8.x * 2) < 1e-6);
  assert.ok(Math.abs(z9.y - z8.y * 2) < 1e-6);
  assert.ok(project(0, 60, 4).y < project(0, -60, 4).y);
});

test('project() clamps the poles instead of returning infinity', () => {
  const p = project(0, 90, 4);
  assert.ok(Number.isFinite(p.y));
  const q = project(0, -90, 4);
  assert.ok(Number.isFinite(q.y));
  assert.ok(p.y < q.y);
});

test('routeBounds() pads, and refuses a single point', () => {
  assert.equal(routeBounds([CASABLANCA]), null);
  const b = routeBounds([CASABLANCA, RABAT], 0.1)!;
  assert.ok(b.minLng < Math.min(CASABLANCA.lng, RABAT.lng));
  assert.ok(b.maxLat > Math.max(CASABLANCA.lat, RABAT.lat));
});

test('routeBounds() gives a parked run a readable frame, not a dot', () => {
  const b = routeBounds([CASABLANCA, { lng: CASABLANCA.lng + 0.0001, lat: CASABLANCA.lat }])!;
  assert.ok(b.maxLng - b.minLng >= 0.004);
  assert.ok(b.maxLat - b.minLat >= 0.004);
});

test('pickZoom() returns the most detailed zoom that still fits', () => {
  const b = routeBounds([CASABLANCA, RABAT])!;
  const z = pickZoom(b, 800, 800);
  const fits = (zoom: number) => {
    const a = project(b.minLng, b.maxLat, zoom);
    const c = project(b.maxLng, b.minLat, zoom);
    return c.x - a.x <= 800 && c.y - a.y <= 800;
  };
  assert.ok(fits(z), `zoom ${z} should fit`);
  assert.ok(!fits(z + 1), `zoom ${z + 1} should not fit`);
});

test('pickZoom() respects the ceiling and never goes negative', () => {
  const tiny: MapBounds = { minLng: -7.59, maxLng: -7.589, minLat: 33.573, maxLat: 33.574 };
  assert.ok(pickZoom(tiny, 4000, 4000) <= 17);
  const world: MapBounds = { minLng: -179, maxLng: 179, minLat: -80, maxLat: 80 };
  assert.ok(pickZoom(world, 100, 100) >= 0);
});

test('tileRange() covers every corner of the bounds', () => {
  const b = routeBounds([CASABLANCA, RABAT])!;
  const z = pickZoom(b, 800, 800);
  const r = tileRange(b, z);
  const topLeft = project(b.minLng, b.maxLat, z);
  const bottomRight = project(b.maxLng, b.minLat, z);
  assert.ok(r.x0 * TILE_PX <= topLeft.x && topLeft.x < (r.x1 + 1) * TILE_PX);
  assert.ok(r.y0 * TILE_PX <= topLeft.y && topLeft.y < (r.y1 + 1) * TILE_PX);
  assert.ok(r.x0 * TILE_PX <= bottomRight.x && bottomRight.x < (r.x1 + 1) * TILE_PX);
  assert.ok(r.y0 * TILE_PX <= bottomRight.y && bottomRight.y < (r.y1 + 1) * TILE_PX);
  // A share card must stay cheap: this is a handful of tiles, not a wall.
  assert.ok((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) <= 24);
});

test('tile URLs point at the themed CARTO basemaps, retina for the canvas', () => {
  assert.match(tileUrl('dark', 12, 3, 5), /dark_all\/12\/3\/5@2x\.png$/);
  assert.match(tileUrl('light', 12, 3, 5), /rastertiles\/voyager\/12\/3\/5@2x\.png$/);
});

test('mapPoint() is project() shifted by the transform offset', () => {
  const t = { z: 10, offX: 42, offY: -7, range: { x0: 0, x1: 1, y0: 0, y1: 1, z: 10 } };
  const viaMap = mapPoint(t, RABAT);
  const viaProject = project(RABAT.lng, RABAT.lat, 10);
  assert.equal(viaMap.x, viaProject.x + 42);
  assert.equal(viaMap.y, viaProject.y - 7);
});

test('the attribution a licence requires is the one we ship', () => {
  assert.match(MAP_ATTRIBUTION, /OpenStreetMap/);
  assert.match(MAP_ATTRIBUTION, /CARTO/);
});
