'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import type { GeoPoint } from '@smartfit/core';

/**
 * The run's basemap, with a fallback chain instead of a single point of
 * failure:
 *
 *   1. **MapLibre GL** over OpenFreeMap vector tiles — labelled, GPU-smooth,
 *      the look of the reference design. Needs WebGL and a modern browser.
 *   2. **Leaflet** over CARTO raster tiles — plain DOM and images, works on
 *      essentially anything with a network connection (older iOS, restricted
 *      WebViews, no WebGL2). Still a real, labelled map.
 *   3. **Nothing** — the vector SVG underlay behind this component carries
 *      the route and the parent shows one honest sentence.
 *
 * A map failure is never a run failure: every engine's startup and every
 * live update is contained, logged as `[run-map] …`, and downgrades to the
 * next rung. Watch behaviour is shared by all engines: follow the latest
 * fix until the athlete drags, double-click hands follow back, checkered
 * flag at the head when reviewing.
 *
 * Both libraries and their CSS load lazily with this component's chunk.
 */

const GL_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

const RASTER_TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
} as const;

const RASTER_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

type Kind = keyof typeof GL_STYLES;
type Engine = 'pending' | 'gl' | 'raster' | 'none';

export function RunMap({
  points,
  position = null,
  accuracy = null,
  follow = true,
  interactive = true,
  showFlag = true,
  className = '',
  onUnavailable,
}: {
  points: GeoPoint[];
  /** The athlete's live fix — a pulsing dot, shown before any route exists. */
  position?: GeoPoint | null;
  /** GPS accuracy in metres, drawn as a soft circle of trust. */
  accuracy?: number | null;
  /** Keep the latest fix centred until the athlete drags the map. */
  follow?: boolean;
  interactive?: boolean;
  /** Checkered flag at the head of the route (the race-map look). */
  showFlag?: boolean;
  className?: string;
  /** Called once if no engine at all can start here. */
  onUnavailable?: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine>('pending');
  const engineRef = useRef<Engine>('pending');
  const setEngineBoth = (next: Engine) => {
    engineRef.current = next;
    setEngine(next);
  };
  const libRef = useRef<any>(null);
  const glRef = useRef<any>(null);
  const rasterRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const userMoved = useRef(false);
  const fitted = useRef(false);

  const pointsRef = useRef(points);
  pointsRef.current = points;
  const positionRef = useRef(position);
  positionRef.current = position;
  const accuracyRef = useRef(accuracy);
  accuracyRef.current = accuracy;
  const followRef = useRef(follow);
  followRef.current = follow;
  const showFlagRef = useRef(showFlag);
  showFlagRef.current = showFlag;
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  const { resolvedTheme } = useTheme();
  const kind: Kind = resolvedTheme === 'dark' ? 'dark' : 'light';
  const kindRef = useRef(kind);
  kindRef.current = kind;

  const fail = (where: string, e: unknown) => {
    console.error(`[run-map] ${where}:`, e);
  };

  /* ── engine 1: MapLibre GL ─────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const probe = document.createElement('canvas');
        const gl =
          probe.getContext('webgl2') ??
          probe.getContext('webgl') ??
          probe.getContext('experimental-webgl');
        if (!gl) throw new Error('WebGL is not available in this browser');

        const [maplibregl] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (cancelled || !holder.current) return;
        libRef.current = maplibregl;
        let map: any;
        try {
          map = new maplibregl.Map({
            container: holder.current,
            style: GL_STYLES[kindRef.current],
            center: initialCenter(),
            zoom: positionRef.current ? 16.5 : 13,
            attributionControl: { compact: true },
            interactive,
            scrollZoom: false,
            doubleClickZoom: false,
            dragRotate: false,
            pitchWithRotate: false,
            fadeDuration: 0,
          });
        } catch (e) {
          throw new Error(`MapLibre could not initialise (${String(e)})`);
        }
        if (cancelled) {
          map.remove();
          return;
        }
        glRef.current = map;
        map.__kind = kindRef.current;

        map.on('dragstart', () => {
          userMoved.current = true;
        });
        map.on('dblclick', () => {
          userMoved.current = false;
          applyPoints(true);
        });
        map.on('error', (e: { error?: { message?: string } }) => {
          if (!holder.current?.dataset.warned) {
            holder.current!.dataset.warned = '1';
            console.warn('[run-map] basemap tile/style error:', e?.error?.message ?? 'unknown');
          }
        });
        map.on('load', () => {
          addGlLayers(map, maplibregl);
          applyPoints(true);
        });
        map.on('style.load', () => {
          if (!map.getLayer('run-line')) {
            addGlLayers(map, maplibregl);
            applyPoints(false);
          }
        });
        setEngineBoth('gl');
      } catch (e) {
        fail('vector basemap unavailable, trying raster', e);
        if (!cancelled) setEngineBoth('raster');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  /* ── engine 2: Leaflet raster ──────────────────────────────────────── */
  useEffect(() => {
    if (engine !== 'raster') return;
    let cancelled = false;
    let map: any = null;
    void (async () => {
      try {
        const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        if (cancelled || !holder.current) return;
        libRef.current = libRef.current ?? L;

        map = L.map(holder.current, {
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
        map.on('dragstart', () => {
          userMoved.current = true;
        });
        map.on('dblclick', () => {
          userMoved.current = false;
          applyPoints(true);
        });
        addRasterTiles(map, L, kindRef.current);
        rasterRef.current = { map, L };
        if (cancelled) {
          map.remove();
          return;
        }
        applyPoints(true);
      } catch (e) {
        fail('raster basemap unavailable too', e);
        if (!cancelled) {
          setEngineBoth('none');
          unavailableRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (map) {
        map.remove();
        rasterRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, interactive]);

  /* ── theme flip ────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      if (engineRef.current === 'gl' && glRef.current) {
        const map = glRef.current;
        if ((map.__kind ?? kind) === kind) return;
        map.__kind = kind;
        map.setStyle(GL_STYLES[kind]);
      } else if (engineRef.current === 'raster' && rasterRef.current) {
        const { map, L } = rasterRef.current;
        addRasterTiles(map, L, kind);
      }
    } catch (e) {
      console.warn('[run-map] restyle skipped:', e);
    }
  }, [kind]);

  /* ── live updates ──────────────────────────────────────────────────── */
  useEffect(() => {
    applyPoints(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, position, accuracy, follow, engine]);

  function initialCenter(): [number, number] {
    const pos = positionRef.current;
    const first = pointsRef.current[0];
    const p = pos ?? first;
    return p ? [p.lng, p.lat] : [-7.5898, 33.5731];
  }

  /* ── GL layers ─────────────────────────────────────────────────────── */
  function addGlLayers(map: any, maplibregl: any) {
    if (map.getSource('run-route')) return;
    map.addSource('run-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addSource('run-pos', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'run-pos-acc',
      type: 'fill',
      source: 'run-pos',
      paint: { 'fill-color': '#4da3ff', 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'run-glow',
      type: 'line',
      source: 'run-route',
      filter: ['==', ['get', 'kind'], 'line'],
      paint: { 'line-color': '#ff7a4d', 'line-width': 12, 'line-opacity': 0.28, 'line-blur': 4 },
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
    if (!map.hasImage('run-flag')) map.addImage('run-flag', c, { pixelRatio: 2 });
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
        visibility: showFlagRef.current ? 'visible' : 'none',
      },
    });
    void maplibregl;
  }
  function addRasterTiles(map: any, L: any, k: Kind) {
    if (map.__tiles) map.removeLayer(map.__tiles);
    map.__tiles = L.tileLayer(RASTER_TILES[k], {
      attribution: RASTER_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
  }

  /** A 40-segment circle `meters` metres around a point — the GPS halo. */
  function accuracyCircle(lng: number, lat: number, meters: number): number[][] {
    const pts: number[][] = [];
    const dLat = meters / 111320;
    const dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return pts;
  }

  /* ── push state into whichever engine is alive ─────────────────────── */
  function applyPoints(force: boolean) {
    try {
      if (engineRef.current === 'gl') applyGl(force);
      else if (engineRef.current === 'raster') applyRaster(force);
    } catch (e) {
      // A broken update downgrades rather than throwing into React.
      fail('map update failed, downgrading', e);
      if (engineRef.current === 'gl') {
        markerRef.current?.remove?.();
        markerRef.current = null;
        glRef.current?.remove();
        glRef.current = null;
        fitted.current = false;
        setEngineBoth('raster');
      } else if (engineRef.current === 'raster') {
        setEngineBoth('none');
        unavailableRef.current?.();
      }
    }
  }

  function applyGl(force: boolean) {
    const map = glRef.current;
    if (!map || !map.getSource('run-route')) return;
    const pts = pointsRef.current;
    const pos = positionRef.current;

    if (pos) {
      const acc = Math.max(4, accuracyRef.current ?? 10);
      map.getSource('run-pos').setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { kind: 'acc' },
            geometry: { type: 'Polygon', coordinates: [accuracyCircle(pos.lng, pos.lat, acc)] },
          },
        ],
      });
      if (!markerRef.current && libRef.current) {
        const el = document.createElement('div');
        el.className = 'run-pos-marker';
        el.setAttribute('aria-label', 'Your position');
        markerRef.current = new libRef.current.Marker({ element: el });
        markerRef.current.addTo(map);
      }
      markerRef.current?.setLngLat([pos.lng, pos.lat]);
    }

    if (pts.length < 2) {
      if (!pos) return;
      if (!fitted.current || force) {
        fitted.current = true;
        map.easeTo({ center: [pos.lng, pos.lat], zoom: 16.5, animate: false });
      } else if (followRef.current && !userMoved.current) {
        map.easeTo({ center: [pos.lng, pos.lat], duration: 350 });
      }
      return;
    }

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
    if (map.getLayer('run-flag')) {
      map.setLayoutProperty('run-flag', 'visibility', showFlagRef.current ? 'visible' : 'none');
    }

    if (!fitted.current || force) {
      fitted.current = true;
      map.fitBounds(coordsToBounds(coords), { padding: 36, animate: false });
      return;
    }
    const target = pos ? [pos.lng, pos.lat] : coords.at(-1);
    if (followRef.current && !userMoved.current) map.easeTo({ center: target, duration: 350 });
  }

  function applyRaster(force: boolean) {
    const cur = rasterRef.current;
    if (!cur) return;
    const { map, L } = cur as { map: any; L: any };
    const pts = pointsRef.current;
    const pos = positionRef.current;

    if (pos) {
      const acc = Math.max(4, accuracyRef.current ?? 10);
      if (!map.__acc) {
        map.__acc = L.circle([pos.lat, pos.lng], {
          radius: acc,
          color: '#4da3ff',
          weight: 1.5,
          opacity: 0.35,
          fillColor: '#4da3ff',
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
      } else {
        map.__acc.setLatLng([pos.lat, pos.lng]);
        map.__acc.setRadius(acc);
      }
      if (!markerRef.current) {
        const el = document.createElement('div');
        el.className = 'run-pos-marker';
        markerRef.current = L.marker([pos.lat, pos.lng], {
          icon: L.divIcon({
            className: '',
            html: el.outerHTML,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          interactive: false,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng([pos.lat, pos.lng]);
      }
    }

    if (pts.length < 2) {
      if (!pos) return;
      if (!fitted.current || force) {
        fitted.current = true;
        map.setView([pos.lat, pos.lng], 16.5, { animate: false });
      } else if (followRef.current && !userMoved.current) {
        map.panTo([pos.lat, pos.lng], { animate: true });
      }
      return;
    }

    const latlngs = pts.map((p) => [p.lat, p.lng]);
    if (!map.__glow) {
      map.__glow = L.polyline(latlngs, {
        color: '#ff7a4d',
        weight: 11,
        opacity: 0.28,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
      }).addTo(map);
      map.__line = L.polyline(latlngs, {
        color: '#ff7a4d',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
      }).addTo(map);
      map.__start = L.circleMarker(latlngs[0], {
        radius: 6,
        color: '#ff7a4d',
        weight: 3,
        fillColor: '#ffffff',
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
      map.__head = L.circleMarker(latlngs.at(-1), {
        radius: 7,
        color: '#141110',
        weight: 3,
        fillColor: '#d9ff5c',
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
    } else {
      map.__glow.setLatLngs(latlngs);
      map.__line.setLatLngs(latlngs);
      map.__start.setLatLng(latlngs[0]);
      map.__head.setLatLng(latlngs.at(-1));
    }

    if (!fitted.current || force) {
      fitted.current = true;
      map.fitBounds(L.latLngBounds(latlngs), { padding: [36, 36], animate: false });
      return;
    }
    const target = pos ? [pos.lat, pos.lng] : latlngs.at(-1);
    if (followRef.current && !userMoved.current) map.panTo(target, { animate: true });
  }

  /* ── unmount: whichever engine is alive goes away cleanly ──────────── */
  useEffect(
    () => () => {
      markerRef.current?.remove?.();
      markerRef.current = null;
      glRef.current?.remove?.();
      glRef.current = null;
      rasterRef.current?.map?.remove?.();
      rasterRef.current = null;
      fitted.current = false;
      userMoved.current = false;
    },
    [],
  );

  if (engine === 'none') return null;
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
