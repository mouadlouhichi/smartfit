'use client';

import { useMemo } from 'react';
import { projectRoute, type GeoPoint } from '@smartfit/core';

/**
 * Inline SVG preview of a GPS route — the same projection the share canvas
 * uses, so what you see is what you get. Purely presentational; the heavy
 * transparent PNG is rendered on demand by `route-art.ts`.
 */
export function RouteMap({
  route,
  className = '',
  stroke = 'var(--chart-1)',
}: {
  route: GeoPoint[];
  className?: string;
  stroke?: string;
}) {
  const { line, start, end } = useMemo(() => projectRoute(route, 100, 8), [route]);
  const d = line
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="GPS route map">
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={start.x} cy={start.y} r={5} fill="#fff" stroke={stroke} strokeWidth={2.5} />
      <circle
        cx={end.x}
        cy={end.y}
        r={5}
        fill="var(--chart-1)"
        stroke="#141110"
        strokeWidth={2.5}
      />
    </svg>
  );
}
