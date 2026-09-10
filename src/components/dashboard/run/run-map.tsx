'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import type { GeoPoint } from '@smartfit/core';

/**
 * A real, labelled, GPU-smooth basemap — MapLibre GL over OpenFreeMap's
 * public vector tiles (OpenStreetMap data, OpenMapTiles schema).
 *
 * Why not Google Maps: Google's JS API needs a billed API key per deployment,
 * phones home with an account-bound SDK, and its free credit is a trap door
 * ($10k-day stories are why OpenFreeMap exists). OpenFreeMap is free with no
 * key, no cookies, no request caps and commercial use allowed; MapLibre adds
 * the required attribution automatically. The look — dark, labelled streets
 * under a glowing route — is the same family as the reference design.
 *
 * Watch behaviour: the map follows your latest fix until you drag it;
 * double-click hands follow back. A checkered flag marks the head of the
 * route, like a race map. If WebGL or the tile CDN is unavailable the
 * container stays empty and the vector underlay behind it carries the run.
 *
 * MapLibre and its CSS load lazily with this component's chunk.
 */

const STYLE_URLS = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

type Kind = keyof typeof STYLE_URLS;

export function RunMap({
  points,
  follow = true,
  interactive = true,
  showFlag = true,
  className = '',
}: {
  points: GeoPoint[];
  /** Keep the latest fix centred until the athlete drags the map. */
  follow?: boolean;
  interactive?: boolean;
  /** Checkered flag at the head of the route (the race-map look). */
  showFlag?: boolean;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const userMoved = useRef(false);
  const fitted = useRef(false);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const followRef = useRef(follow);
  followRef.current = follow;
  const showFlagRef = useRef(showFlag);
  showFlagRef.current = showFlag;

  const { resolvedTheme } = useTheme();
  const kind: Kind = resolvedTheme === 'dark' ? 'dark' : 'light';

  /* create / destroy */
  useEffect(() => {
    let cancelled = false;
    let map: any = null;

    void (async () => {
      const [maplibregl] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      if (cancelled || !holder.current) return;

      map = new maplibregl.Map({
        container: holder.current,
        style: STYLE_URLS[kindAtStart.current],
        center: [pointsRef.current[0]?.lng ?? -7.5898, pointsRef.current[0]?.lat ?? 33.5731],
        zoom: 13,
        attributionControl: { compact: true },
        interactive,
        scrollZoom: false,
        doubleClickZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 0,
      });
      mapRef.current = map;

      map.on('dragstart', () => {
        userMoved.current = true;
      });
      map.on('dblclick', () => {
        userMoved.current = false;
        applyPoints(true);
      });
      map.on('error', (e: { error?: { message?: string } }) => {
        // Offline / blocked CDN / no WebGL: the underlay carries the route.
        if (!holder.current?.dataset.warned) {
          holder.current!.dataset.warned = '1';
          console.warn('[run-map] basemap unavailable:', e?.error?.message ?? 'unknown');
        }
      });

      map.on('load', () => {
        addRunLayers(map, maplibregl);
        applyPoints(true);
      });
      // Restyle (theme flip) wipes custom layers — put them back.
      map.on('style.load', () => {
        if (map.style?._layers && !map.getLayer('run-line')) {
          addRunLayers(map, maplibregl);
          applyPoints(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      fitted.current = false;
      userMoved.current = false;
    };
  }, [interactive]);

  const kindAtStart = useRef(kind);
  kindAtStart.current = kind;

  /* theme flip */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded || map.getStyle()?.sprite === undefined) return;
    if ((map.__kind ?? kind) === kind) return;
    map.__kind = kind;
    map.setStyle(STYLE_URLS[kind]);
  }, [kind]);

  /* new fixes */
  useEffect(() => {
    applyPoints(false);
  }, [points, follow]);

  /* ── layers: glow + gradient line + start + head + flag ─────────────── */
  function addRunLayers(map: any, maplibregl: any) {
    if (map.getSource('run-route')) return;
    map.addSource('run-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'run-glow',
      type: 'line',
      source: 'run-route',
      filter: ['==', ['get', 'kind'], 'line'],
      paint: {
        'line-color': '#ff7a4d',
        'line-width': 12,
        'line-opacity': 0.28,
        'line-blur': 4,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addLayer({
      id: 'run-line',
      type: 'line',
      source: 'run-route',
      filter: ['==', ['get', 'kind'], 'line'],
      paint: {
        'line-color': ['interpolate', ['linear'], ['line-progress'], 0, '#ff7a4d', 1, '#f0a37f'],
        'line-width': 4.5,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addLayer({
      id: 'run-start',
      type: 'circle',
      source: 'run-route',
      filter: ['==', ['get', 'kind'], 'start'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#ff7a4d',
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'run-head',
      type: 'circle',
      source: 'run-route',
      filter: ['==', ['get', 'kind'], 'head'],
      paint: {
        'circle-radius': 6.5,
        'circle-color': '#d9ff5c',
        'circle-stroke-color': '#141110',
        'circle-stroke-width': 3,
      },
    });

    // Checkered flag, drawn once into an image the style can place.
    const c = document.createElement('canvas');
    c.width = 44;
    c.height = 56;
    const g = c.getContext('2d');
    if (g) {
      g.strokeStyle = '#f7f2ea';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(8, 54);
      g.lineTo(8, 6);
      g.stroke();
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 6; x++) {
          g.fillStyle = (x + y) % 2 === 0 ? '#141110' : '#f7f2ea';
          g.fillRect(8 + x * 5, 6 + y * 5, 5, 5);
        }
      }
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.5;
      g.strokeRect(8, 6, 30, 20);
    }
    if (!map.hasImage('run-flag')) {
      map.addImage('run-flag', c, { pixelRatio: 2 });
    }
    map.addLayer({
      id: 'run-flag',
      type: 'symbol',
      source: 'run-route',
      filter: ['==', ['get', 'kind'], 'head'],
      layout: {
        'icon-image': 'run-flag',
        'icon-anchor': 'bottom-left',
        'icon-offset': [2, -8],
        'icon-allow-overlap': true,
        // The flag only appears when the run is being reviewed, not mid-stride.
        visibility: showFlagRef.current ? 'visible' : 'none',
      },
    });
    void maplibregl;
  }

  /* ── push the trace into the source ─────────────────────────────────── */
  function applyPoints(force: boolean) {
    const map = mapRef.current;
    if (!map || !map.getSource('run-route')) return;
    const pts = pointsRef.current;
    if (pts.length < 2) return;

    const coords = pts.map((p) => [p.lng, p.lat]);
    map.getSource('run-route').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'line' },
          geometry: { type: 'LineString', coordinates: coords },
        },
        {
          type: 'Feature',
          properties: { kind: 'start' },
          geometry: { type: 'Point', coordinates: coords[0] },
        },
        {
          type: 'Feature',
          properties: { kind: 'head' },
          geometry: { type: 'Point', coordinates: coords.at(-1) },
        },
      ],
    });
    const flagVisible = showFlagRef.current ? 'visible' : 'none';
    if (map.getLayer('run-flag')) map.setLayoutProperty('run-flag', 'visibility', flagVisible);

    if (!fitted.current || force) {
      fitted.current = true;
      map.fitBounds(coordsToBounds(coords), { padding: 36, animate: false });
      return;
    }
    if (followRef.current && !userMoved.current) {
      map.easeTo({ center: coords.at(-1), duration: 350 });
    }
  }

  return (
    <div
      ref={holder}
      className={className}
      style={{ background: 'transparent' }}
      role="img"
      aria-label="Map of the run route"
    />
  );
}

/** Plain-array bounds → the LatLngBounds-like array pairs fitBounds accepts. */
function coordsToBounds(coords: number[][]): [[number, number], [number, number]] {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
