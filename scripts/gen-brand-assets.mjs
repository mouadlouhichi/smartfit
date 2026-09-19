/**
 * Regenerates every brand asset from the one Volt mark: the rounded-square
 * charge cell in volt (#8AD200, mirroring src/lib/brand-mark.ts and
 * --color-volt) with the near-black flame stroked exactly as Lucide draws
 * it — the badge that leads the dashboard header greeting. Run with
 * `node scripts/gen-brand-assets.mjs` after touching the mark.
 *
 * Two variants, same glyph:
 *   - charge cell on transparent → favicon, PWA icons, Expo favicon (the
 *     "icon" look, exactly like the header badge);
 *   - full-bleed volt tile       → maskable/adaptive tiles and Apple touch
 *     icon, where the OS crops or rounds the canvas itself.
 *
 * `og.png`, its vector source (`assets/og.svg`) and the Expo splash are
 * composed here from scratch: the wordmark and headline are set from
 * IBM Plex Sans Bold (OFL, pulled from @fontsource — the closest open
 * neo-grotesque to Helvetica so the canvas render matches the brand type)
 * converted to paths with opentype.js, so no fontconfig is involved and the
 * output is identical on every machine.
 *
 * After running it, bump the `?v=` revision on the icon URLs in
 * `src/app/layout.tsx` and `public/manifest.webmanifest` — home-screen and
 * PWA icons are cached by URL, and a new query is the only thing that makes
 * phones refetch bytes that kept their path.
 */
import sharp from 'sharp';
import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);

/* ── brand constants (mirrors src/lib/brand-mark.ts) ─────────────────── */

const VOLT = '#8ad200';
const VOLT_SOFT = '#b4e761';
const INK = '#101010';
const CANVAS = '#0e0e0e';
const PAPER = '#f5f5f2';

/**
 * Lucide's `flame` glyph in its native 24×24 box — mirrors FLAME_PATH in
 * src/lib/brand-mark.ts (kept identical by tests/mobile-overflow.test.ts,
 * which reads the path straight out of the installed lucide-react).
 */
const FLAME_PATH =
  'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4';
/** Mirrors FLAME_STROKE in src/lib/brand-mark.ts. */
const FLAME_STROKE = 2;

/** The glyph the way lucide.dev renders it: round stroke, no fill. */
const glyph = (ink, stroke = FLAME_STROKE) =>
  `<path d="${FLAME_PATH}" fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * A 2-unit stroke is a hairline once the tile is 32px wide, so the favicon
 * rasters widen it optically — and let the glyph take more of the cell.
 * Vectors and big tiles keep Lucide's own weight and proportions.
 */
const optical = (px) =>
  px <= 16 ? { stroke: 3, ratio: 0.74 } : px <= 32 ? { stroke: 2.75, ratio: 0.66 } : {};

/** Charge cell + flame at (x,y) with the glyph scaled to `box` px. */
const markGroup = (
  x,
  y,
  box,
  { plate = VOLT, ink = INK, rx = 0.3, stroke = FLAME_STROKE, ratio = 0.6 } = {},
) => {
  const s = (box * ratio) / 24;
  const t = (box - 24 * s) / 2;
  return (
    `<g transform="translate(${x},${y})">` +
    `<rect width="${box}" height="${box}" rx="${box * rx}" fill="${plate}"/>` +
    `<g transform="translate(${t},${t}) scale(${s})">${glyph(ink, stroke)}</g>` +
    `</g>`
  );
};

/** Full-bleed volt tile with the flame inside the maskable safe zone (~80%). */
const tileGroup = (box, { plate = VOLT, ink = INK } = {}) => {
  const inner = box * 0.68;
  return (
    `<rect width="${box}" height="${box}" fill="${plate}"/>` +
    markGroup((box - inner) / 2, (box - inner) / 2, inner, { plate: 'none', ink })
  );
};

const markSvg = (stroke = FLAME_STROKE, ratio = 0.6) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${markGroup(0, 0, 512, { stroke, ratio })}</svg>`;
const MARK_SVG = markSvg();
const MARK_MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${tileGroup(512)}</svg>`;
const TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="${VOLT}"/>${markGroup(0, 0, 512, { plate: 'none' })}</svg>`;

/* ── typography → vector paths (deterministic, no fontconfig) ─────────── */

function fsWoff(path) {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const fontBold = opentype.parse(
  fsWoff(require.resolve('@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff')),
);

/** Text as an SVG path string (x = left, y = baseline). */
const textPath = (text, x, y, size, fill, { opacity = 1, letterSpacing = 0 } = {}) => {
  const path = fontBold.getPath(text, x, y, size, { letterSpacing });
  return `<path d="${path.toPathData(2)}" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
};

const textWidth = (text, size, letterSpacing = 0) =>
  fontBold.getAdvanceWidth(text, size, { letterSpacing });

/** Wordmark: white "Smart" + volt "Fit", one shared baseline. */
const wordmarkPaths = (x, y, size) => {
  const head = textPath('Smart', x, y, size, PAPER);
  const w = textWidth('Smart', size);
  const tail = textPath('Fit', x + w, y, size, VOLT);
  return { svg: head + tail, width: w + textWidth('Fit', size) };
};

/* ── the OG share card, 1200×630 ──────────────────────────────────────── */

function ogSvg() {
  const W = 1200;
  const H = 630;
  const pad = 92;

  const markSize = 104;
  const wm = 62;
  const wordmark = wordmarkPaths(pad, 78 + markSize / 2 + wm * 0.34, wm);

  const headlineSize = 116;
  const line1Y = 352;
  const line2Y = line1Y + headlineSize * 1.06;
  const line1 = 'Train with';
  const line2 = 'intention.';
  // The final word picks up the volt accent, magazine-style.
  const l1 = textPath(line1, pad, line1Y, headlineSize, PAPER);
  const l2a = textPath('inten', pad, line2Y, headlineSize, PAPER);
  const l2b = textPath('tion.', pad + textWidth('inten', headlineSize), line2Y, headlineSize, VOLT);

  const chips = ['Plan', 'Log', 'Progress', 'Run'];
  const chipSize = 27;
  const chipH = 52;
  let cx = pad;
  const chipY = 548;
  let chipsSvg = '';
  for (const c of chips) {
    const w = textWidth(c, chipSize, 0.01) + 52;
    chipsSvg +=
      `<rect x="${cx}" y="${chipY}" width="${w}" height="${chipH}" rx="${chipH / 2}" ` +
      `fill="none" stroke="rgba(245,245,242,0.22)" stroke-width="2"/>` +
      textPath(
        c,
        cx + 26,
        chipY + chipH / 2 + chipSize * 0.34,
        chipSize,
        'rgba(245,245,242,0.85)',
        {
          letterSpacing: 0.01,
        },
      );
    cx += w + 16;
  }

  // Watermark: a giant flame, ghosted behind the right edge.
  const flameS = 620 / 24;
  const watermark =
    `<g transform="translate(820,60) scale(${flameS})" opacity="0.07">` +
    `${glyph(VOLT)}</g>` +
    `<circle cx="1040" cy="315" r="225" fill="none" stroke="${VOLT}" stroke-width="2" opacity="0.16"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="0.88" cy="-0.1" r="0.9">
      <stop offset="0" stop-color="${VOLT}" stop-opacity="0.22"/>
      <stop offset="0.55" stop-color="${VOLT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.02" cy="1.05" r="0.7">
      <stop offset="0" stop-color="${VOLT}" stop-opacity="0.07"/>
      <stop offset="0.6" stop-color="${VOLT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${CANVAS}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  ${watermark}
  <rect x="0" y="0" width="${W}" height="6" fill="${VOLT}"/>
  ${markGroup(pad, 78, markSize)}
  ${textPath('SMARTFIT', pad + markSize + 26, 78 + markSize / 2 + 9, 21, 'rgba(245,245,242,0.55)', { letterSpacing: 0.32 })}
  ${l1}${l2a}${l2b}
  ${chipsSvg}
</svg>`;
}

/* ── Expo splash, 1242×2436 ───────────────────────────────────────────── */

function splashSvg() {
  const W = 1242;
  const H = 2436;
  const markSize = 340;
  const cx = (W - markSize) / 2;
  const markY = H / 2 - markSize - 60;
  const wm = 104;
  const wordmark = wordmarkPaths(0, 0, wm);
  const wmX = (W - wordmark.width) / 2;
  const wmY = markY + markSize + 128;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${CANVAS}"/>
  <defs>
    <radialGradient id="sg" cx="0.5" cy="0.42" r="0.5">
      <stop offset="0" stop-color="${VOLT}" stop-opacity="0.10"/>
      <stop offset="0.7" stop-color="${VOLT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sg)"/>
  ${markGroup(cx, markY, markSize)}
  <g transform="translate(${wmX},${wmY})">${wordmark.svg}</g>
</svg>`;
}

/* ── favicon.ico: a hand-rolled PNG-in-ICO container ──────────────────── */

async function faviconIco() {
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) {
    const o = optical(s);
    pngs.push({
      size: s,
      data: await sharp(svgBuffer(markSvg(o.stroke ?? FLAME_STROKE, o.ratio ?? 0.6)))
        .resize(s, s)
        .png()
        .toBuffer(),
    });
  }
  // ICONDIR + ICONDIRENTRY table, then the bundled PNG blobs.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // colors
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const svgBuffer = (s) => Buffer.from(s);
const render = (source, size) => sharp(svgBuffer(source)).resize(size, size).png().toBuffer();

const put = async (buf, path) => {
  writeFileSync(path, buf);
  console.log('wrote', path);
};

/* ── emit everything ──────────────────────────────────────────────────── */

writeFileSync('public/icon.svg', MARK_SVG);
writeFileSync('apps/mobile/assets/icon.svg', MARK_SVG);
writeFileSync('assets/mark.svg', MARK_SVG);
writeFileSync('assets/mark-maskable.svg', MARK_MASKABLE_SVG);
console.log('wrote icon/mark SVGs');

const disc512 = await render(MARK_SVG, 512);
const tile512 = await render(MARK_MASKABLE_SVG, 512);
const roundedTile = await render(TILE_SVG, 512);

await put(disc512, 'public/icons/icon-512.png');
await put(await render(MARK_SVG, 192), 'public/icons/icon-192.png');
await put(
  await render(markSvg(optical(32).stroke ?? FLAME_STROKE, optical(32).ratio ?? 0.6), 32),
  'public/icons/icon-32.png',
);
await put(await render(MARK_SVG, 64), 'apps/mobile/assets/favicon.png');
await put(tile512, 'public/icons/maskable-512.png');
await put(await render(MARK_MASKABLE_SVG, 180), 'public/apple-touch-icon.png');
await put(roundedTile, 'apps/mobile/assets/icon.png');
await put(tile512, 'apps/mobile/assets/adaptive-icon.png');
await put(await faviconIco(), 'public/favicon.ico');

await put(Buffer.from(ogSvg()), 'assets/og.svg');
await put(
  await sharp(svgBuffer(ogSvg()), { density: 96 }).resize(1200, 630).png().toBuffer(),
  'public/og.png',
);
await put(
  await sharp(svgBuffer(splashSvg()), { density: 96 }).resize(1242, 2436).png().toBuffer(),
  'apps/mobile/assets/splash.png',
);

console.log('done — bump the ?v= revision in src/app/layout.tsx + public/manifest.webmanifest');
