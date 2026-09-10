'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import type { Map as LeafletMap, Polyline, CircleMarker, TileLayer } from 'leaflet';
import type * as Leaflet from 'leaflet';
import { MAP_ATTRIBUTION, leafletTileUrl, type MapKind } from '@/lib/map-tiles';
import type { GeoPoint } from '@smartfit/core';

/**
 * A real basemap under the route — Leaflet over public CARTO/OSM raster
 * tiles, themed to match the app (near-black at night, warm paper by day).
 *
 * Behaviour borrowed from running watches: the map follows you while you
 * run, and the moment you drag it, it obeys you instead (double-tap/click
 * hands follow back). Tiles are plain images fetched by the browser, so a
 * blocked or offline network degrades to the textured panel behind this
 * component rather than breaking the run.
 *
 * Leaflet and its CSS are imported lazily: the ~40 kB only lands when a
 * screen with a map on it actually mounts.
 */
export function RunMap({
  points,
  follow = true,
  interactive = true,
  className = '',
}: {
  points: GeoPoint[];
  /** Keep the latest fix centred until the athlete drags the map. */
  follow?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const glowRef = useRef<Polyline | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const startRef = useRef<CircleMarker | null>(null);
  const headRef = useRef<CircleMarker | null>(null);
  const userMoved = useRef(false);
  const fitted = useRef(false);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const { resolvedTheme } = useTheme();
  const kind: MapKind = resolvedTheme === 'dark' ? 'dark' : 'light';
  const kindRef = useRef(kind);
  kindRef.current = kind;

  /* create / destroy */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      if (cancelled || !holder.current) return;
      LRef.current = L;

      const map = L.map(holder.current, {
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        touchZoom: interactive,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        keyboard: false,
        zoomSnap: 0.5,
      });
      map.attributionControl.setPrefix('');
      // Dragging means "I want to look somewhere else"; double-click takes
      // the wheel back.
      map.on('dragstart', () => {
        userMoved.current = true;
      });
      map.on('dblclick', () => {
        userMoved.current = false;
        applyPoints(true);
      });

      tilesRef.current = L.tileLayer(leafletTileUrl(kindRef.current), {
        attribution: MAP_ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      applyPoints(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tilesRef.current = null;
      glowRef.current = null;
      lineRef.current = null;
      startRef.current = null;
      headRef.current = null;
      fitted.current = false;
      userMoved.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  /* retheme tiles with the app */
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !tilesRef.current) return;
    map.removeLayer(tilesRef.current);
    tilesRef.current = L.tileLayer(leafletTileUrl(kind), {
      attribution: MAP_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    tilesRef.current.bringToBack();
  }, [kind]);

  /* new fixes */
  useEffect(() => {
    applyPoints(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, follow]);

  function applyPoints(force: boolean) {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const pts = pointsRef.current;
    if (pts.length < 2) return;

    const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
    if (!lineRef.current) {
      glowRef.current = L.polyline(latlngs, {
        color: '#ff7a4d',
        weight: 11,
        opacity: 0.28,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
      }).addTo(map);
      lineRef.current = L.polyline(latlngs, {
        color: '#ff7a4d',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
      }).addTo(map);
      startRef.current = L.circleMarker(latlngs[0], {
        radius: 6,
        color: '#ff7a4d',
        weight: 3,
        fillColor: '#ffffff',
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
      headRef.current = L.circleMarker(latlngs.at(-1)!, {
        radius: 7,
        color: '#141110',
        weight: 3,
        fillColor: '#d9ff5c',
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
    } else {
      lineRef.current.setLatLngs(latlngs);
      glowRef.current?.setLatLngs(latlngs);
      startRef.current?.setLatLng(latlngs[0]);
      headRef.current?.setLatLng(latlngs.at(-1)!);
    }

    if (!fitted.current || force) {
      fitted.current = true;
      map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], animate: false });
      return;
    }
    if (follow && !userMoved.current) {
      map.panTo(latlngs.at(-1)!, { animate: true });
    }
  }

  return (
    <div
      ref={holder}
      className={className}
      style={{ background: 'transparent' }}
      aria-label="Map of the run route"
      role="img"
    />
  );
}
