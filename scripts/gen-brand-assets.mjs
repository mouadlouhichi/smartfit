/**
 * Regenerates every raster brand asset from the one mark: the charcoal disc
 * with the white flame — the badge that leads the dashboard header greeting.
 * Run with `node scripts/gen-brand-assets.mjs` after touching the mark.
 *
 * Two variants, same glyph:
 *   - disc on transparent  → favicon, PWA icons, Expo favicon (the "icon"
 *     look, exactly like the header badge);
 *   - full-bleed charcoal  → maskable/adaptive tiles and Apple touch icon,
 *     where the OS crops or rounds the canvas itself.
 *
 * `og.png` and the Expo splash keep their existing composition: the script
 * locates the previous ember tile by colour, repaints its box with the
 * surrounding background and seats the new mark in the same spot.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const CHARCOAL = '#3f3d3b';
const EMBER = { r: 0xe0, g: 0x5e, b: 0x36 }; // previous mark colour, for bbox hunt
const FLAME =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 ' +
  '.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

const glyph = (box) => {
  const s = (box * 0.58) / 24;
  const t = (512 - 24 * s) / 2;
  return `<g transform="translate(${t},${t}) scale(${s})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${FLAME}"/></g>`;
};

const DISC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${CHARCOAL}"/>${glyph(512)}</svg>`;
const TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="${CHARCOAL}"/>${glyph(512)}</svg>`;

const svg = (s) => Buffer.from(s);
const render = (source, size) => sharp(svg(source)).resize(size, size).png().toBuffer();

/** Bounding box of pixels close to the previous ember tile. */
async function emberBox(file, maxY = Infinity) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < Math.min(info.height, maxY); y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (
        Math.abs(data[i] - EMBER.r) < 30 &&
        Math.abs(data[i + 1] - EMBER.g) < 30 &&
        Math.abs(data[i + 2] - EMBER.b) < 30
      ) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`no ember pixels found in ${file}`);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, data, info };
}

/** Repaint the old tile's box with its surroundings, seat the new mark. */
async function swapMark(file, maxY) {
  const { left, top, width, height, data, info } = await emberBox(file, maxY);
  // Background colour: median of the ring just outside the old box.
  const ring = [];
  const at = (x, y) => {
    const i = (y * info.width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  for (let x = Math.max(0, left - 6); x <= Math.min(info.width - 1, left + width + 5); x++) {
    if (top - 6 >= 0) ring.push(at(x, top - 6));
    if (top + height + 5 < info.height) ring.push(at(x, top + height + 5));
  }
  ring.sort((a, b) => a[0] - b[0]);
  const [r, g, b] = ring[Math.floor(ring.length / 2)];
  const patch = await sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const mark = await render(DISC_SVG, width);
  const out = await sharp(file)
    .composite([
      { input: patch, left, top },
      { input: mark, left, top },
    ])
    .png()
    .toBuffer();
  writeFileSync(file, out); // sharp refuses same-file in/out; buffer round-trip
  console.log(`swapped mark in ${file} @${left},${top} ${width}x${height} on rgb(${r},${g},${b})`);
}

const put = async (buf, path) => {
  writeFileSync(path, buf);
  console.log('wrote', path);
};

const disc512 = await render(DISC_SVG, 512);
const tile512 = await render(TILE_SVG, 512);

writeFileSync('public/icon.svg', DISC_SVG);
writeFileSync('apps/mobile/assets/icon.svg', DISC_SVG);
console.log('wrote public/icon.svg + apps/mobile/assets/icon.svg');

await put(disc512, 'public/icons/icon-512.png');
await put(await render(DISC_SVG, 192), 'public/icons/icon-192.png');
await put(await render(DISC_SVG, 32), 'public/icons/icon-32.png');
await put(await render(DISC_SVG, 64), 'apps/mobile/assets/favicon.png');
await put(tile512, 'public/icons/maskable-512.png');
await put(await render(TILE_SVG, 180), 'public/apple-touch-icon.png');
await put(tile512, 'apps/mobile/assets/icon.png');
await put(tile512, 'apps/mobile/assets/adaptive-icon.png');

await swapMark('public/og.png', 400); // the ember underline bar lives lower down
await swapMark('apps/mobile/assets/splash.png', Infinity);
