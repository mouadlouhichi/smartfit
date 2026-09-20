'use client';

import { useRef } from 'react';
import { useAnimatedCanvas } from './use-animated-canvas';

const chars = '░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯';

/** #rrggbb → rgba() with alpha so canvas can use the theme's hex tokens. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(138, 210, 0, ${alpha})`;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Resolving CSS custom properties every frame is wasteful; refresh on a
// 2-second cadence so a theme flip still repaints almost immediately.
let colorCache: { el: HTMLCanvasElement; fore: string; volt: string; ts: number } | null = null;

function themeColors(canvas: HTMLCanvasElement) {
  const now = Date.now();
  if (colorCache && colorCache.el === canvas && now - colorCache.ts < 2000) return colorCache;
  const cs = getComputedStyle(canvas);
  colorCache = {
    el: canvas,
    fore: cs.getPropertyValue('--foreground').trim() || '#131311',
    volt: cs.getPropertyValue('--color-volt').trim() || '#8ad200',
    ts: now,
  };
  return colorCache;
}

function drawSphere(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  ctx.clearRect(0, 0, rect.width, rect.height);

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(rect.width, rect.height) * 0.525;

  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const step = 0.18;
  const points: { x: number; y: number; z: number; char: string }[] = [];

  for (let phi = 0; phi < Math.PI * 2; phi += step) {
    for (let theta = 0; theta < Math.PI; theta += step) {
      const x = Math.sin(theta) * Math.cos(phi + time * 0.5);
      const y = Math.sin(theta) * Math.sin(phi + time * 0.5);
      const z = Math.cos(theta);

      // Rotate around Y axis
      const rotY = time * 0.3;
      const newX = x * Math.cos(rotY) - z * Math.sin(rotY);
      const newZ = x * Math.sin(rotY) + z * Math.cos(rotY);

      // Rotate around X axis
      const rotX = time * 0.2;
      const newY = y * Math.cos(rotX) - newZ * Math.sin(rotX);
      const finalZ = y * Math.sin(rotX) + newZ * Math.cos(rotX);

      const depth = (finalZ + 1) / 2;
      const charIndex = Math.floor(depth * (chars.length - 1));

      points.push({
        x: centerX + newX * radius,
        y: centerY + newY * radius,
        z: finalZ,
        char: chars[charIndex],
      });
    }
  }

  // Sort by z for depth
  points.sort((a, b) => a.z - b.z);

  // Theme-aware ink: the front hemisphere burns in volt, the back fades into
  // the theme's foreground. (It used to be pure black — invisible on the dark
  // landing, which is why the sphere "disappeared".)
  const { fore, volt } = themeColors(canvas);
  points.forEach((point) => {
    const depth = (point.z + 1) / 2; // 0 = far side, 1 = near side
    ctx.fillStyle =
      point.z >= 0 ? withAlpha(volt, 0.35 + depth * 0.6) : withAlpha(fore, 0.1 + depth * 0.22);
    ctx.fillText(point.char, point.x, point.y);
  });
}

/**
 * Decorative ASCII sphere — runs through the shared canvas hook so it
 * respects reduced motion, pauses off-screen and caps the DPR.
 */
export function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAnimatedCanvas(canvasRef, drawSphere);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: 'block' }} />;
}
