import { MEAL_PHOTO_MAX_BYTES, type MealScan, type RecognizedItem } from '@smartfit/core';

/**
 * Client half of the photo scan.
 *
 * Three jobs, in this order:
 *
 *  1. **Shrink the photo before it leaves the phone.** A modern phone camera
 *     produces 3–8 MB; a data URL of that is 4–11 MB of JSON, which the route
 *     rejects and a metered connection resents. Downscaling to 1024 px at
 *     quality 0.72 lands comfortably inside the ceiling while staying legible
 *     enough to count chicken thighs.
 *  2. **Call the deployment's own `/api/meal-scan`** — never a provider
 *     directly, so no key is ever in the bundle.
 *  3. **Report honestly when it cannot.** No provider configured, offline, a
 *     text-only model, a refused image: each produces a specific message the
 *     modal shows next to the still-working type-it-in box.
 */

export const MEAL_SCAN_PATH = '/api/meal-scan';

export class MealScanError extends Error {
  override name = 'MealScanError';
  /** Machine-readable cause, so the UI can pick the right fallback copy. */
  readonly code:
    | 'not-configured'
    | 'unreachable'
    | 'timeout'
    | 'rate-limited'
    | 'too-large'
    | 'bad-image'
    | 'provider'
    | 'bad-response';
  constructor(message: string, code: MealScanError['code'] = 'provider') {
    super(message);
    this.code = code;
  }
}

export interface MealScanAvailability {
  available: boolean;
  host: string;
  model: string;
}

let probe: Promise<MealScanAvailability> | null = null;

/**
 * Is the photo path live on this deployment?
 *
 * Probed once per session (the answer only changes when the deployment does)
 * and cached, exactly like the coach's availability check. A static export or
 * an offline PWA fails the probe quietly and the photo button simply does not
 * appear — no dead control, no error toast for a feature that was never
 * configured.
 */
export function resolveMealScanAvailability(
  fetchImpl: typeof fetch = fetch,
): Promise<MealScanAvailability> {
  if (probe) return probe;
  probe = (async (): Promise<MealScanAvailability> => {
    try {
      const res = await fetchImpl(MEAL_SCAN_PATH, { headers: { accept: 'application/json' } });
      if (res.ok) {
        const info = (await res.json()) as {
          configured?: boolean;
          ok?: boolean;
          host?: string;
          model?: string;
        };
        if (info.configured && info.ok !== false) {
          return { available: true, host: info.host ?? '', model: info.model ?? '' };
        }
      }
    } catch {
      /* no route (static hosting), offline, or a 404 — all mean "not available" */
    }
    return { available: false, host: '', model: '' };
  })();
  return probe;
}

/** Test seam: forget the cached probe. */
export function resetMealScanAvailability(): void {
  probe = null;
}

export interface PhotoScanResult {
  /** Macros, computed server-side from `FOOD_DB` — never by the model. */
  scan: MealScan;
  items: RecognizedItem[];
  /** True when the model recognised nothing (or answered with prose). */
  empty: boolean;
  model: string;
}

/**
 * Send one photo and get back a recognisable meal.
 *
 * `signal` lets the modal cancel a photo the athlete has already replaced.
 */
export async function scanMealPhoto(
  file: Blob,
  opts: { locale?: string; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<PhotoScanResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let image: string;
  try {
    image = await shrinkForUpload(file);
  } catch {
    throw new MealScanError('That file could not be read as an image.', 'bad-image');
  }

  if (image.length > MEAL_PHOTO_MAX_BYTES) {
    throw new MealScanError('That photo is still too large after resizing.', 'too-large');
  }

  let res: Response;
  try {
    res = await fetchImpl(MEAL_SCAN_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, locale: opts.locale }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') {
      throw new MealScanError('The scan was stopped.', 'timeout');
    }
    throw new MealScanError('Could not reach the scan service.', 'unreachable');
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    const code = (detail?.code ?? 'provider') as MealScanError['code'];
    throw new MealScanError(detail?.error || `The scan failed (${res.status}).`, code);
  }

  const body = (await res.json().catch(() => null)) as PhotoScanResult | null;
  if (!body || typeof body !== 'object' || !body.scan) {
    throw new MealScanError('The scan returned an unexpected answer.', 'bad-response');
  }
  return { ...body, model: body.model ?? '' };
}

/** Longest edge of the image we upload. */
export const UPLOAD_MAX_PX = 1024;
/** JPEG quality of the re-encode — 0.72 is the knee of size vs. legibility. */
export const UPLOAD_QUALITY = 0.72;

/**
 * Downscale a photo to a JPEG data URL small enough to POST.
 *
 * Uses `createImageBitmap` + a canvas when available (every current browser,
 * and it keeps the decode off the main thread); falls back to an `<img>` when
 * not. If the browser can do neither — or the re-encode somehow comes out
 * *larger* than the original, which happens with tiny already-optimised
 * images — the original data URL is returned and the ceiling is enforced by
 * the caller.
 */
export async function shrinkForUpload(
  file: Blob,
  maxPx: number = UPLOAD_MAX_PX,
  quality: number = UPLOAD_QUALITY,
): Promise<string> {
  const original = await readAsDataUrl(file);
  if (typeof document === 'undefined') return original;

  let source: CanvasImageSource & { width: number; height: number };
  let release: () => void = () => {};
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    release = () => bitmap.close();
  } else {
    const img = await loadImage(original);
    source = img;
  }

  try {
    const scale = Math.min(1, maxPx / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(source, 0, 0, width, height);
    const encoded = canvas.toDataURL('image/jpeg', quality);
    // An identity check on shape, not just size: some browsers hand back
    // "data:," when a canvas is tainted or too large.
    if (
      !encoded.startsWith('data:image/jpeg;base64,') ||
      encoded.length <= 'data:image/jpeg;base64,'.length
    ) {
      return original;
    }
    return encoded.length < original.length ? encoded : original;
  } finally {
    release();
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement & { width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image.'));
    img.src = src;
  });
}

/**
 * Copy for each failure, so the modal never says "something went wrong".
 * Falls back to the error's own message for anything unmapped.
 */
export function photoScanMessage(error: unknown, t: (key: string) => string): string {
  if (!(error instanceof MealScanError)) return t('meal.photo.failed');
  switch (error.code) {
    case 'not-configured':
      return t('meal.photo.unavailable');
    case 'rate-limited':
      return 'That is a lot of photo scans in a row — give it a few minutes, or type the meal instead.';
    case 'timeout':
      return 'The scan took too long and was stopped. Typing it in still works.';
    case 'unreachable':
      return 'No connection to the scan service. The on-device scan works offline — type the meal instead.';
    case 'bad-image':
    case 'too-large':
      return 'That photo could not be processed. Try another, or type the meal instead.';
    default:
      return t('meal.photo.failed');
  }
}
