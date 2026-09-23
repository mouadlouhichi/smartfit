/**
 * Server-side validation for the photo-scan route (`/api/meal-scan`).
 *
 * It lives here rather than in the route file for two reasons: Next.js only
 * allows a fixed set of exports from a route module, and this is exactly the
 * kind of rule that deserves a unit test without standing up a request.
 *
 * This module reads no secrets — it only inspects a request body — so it is
 * safe to import from tests and from the route alike.
 */
import { MEAL_PHOTO_MAX_BYTES, buildMealScanPrompt, resolveLocale } from '@smartfit/core';
import { readVisionModel, type ServerAiConfig } from './ai-coach-server';

/** `data:image/<known type>;base64,<payload>` and nothing else. */
const DATA_URL = /^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,[A-Za-z0-9+/=]+$/i;

export type MealScanRequest =
  { ok: true; image: string; locale: string } | { ok: false; status: number; error: string };

/**
 * Validate a `/api/meal-scan` body.
 *
 * The ceiling is enforced *here* as well as in the client, because the client
 * is not a security boundary: an 8 MB data URL would otherwise be forwarded to
 * a metered provider on someone else's bill.
 */
export function parseMealScanRequest(raw: unknown): MealScanRequest {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, status: 400, error: 'Expected a JSON object.' };
  }
  const { image, locale } = raw as { image?: unknown; locale?: unknown };
  if (typeof image !== 'string' || image.length === 0) {
    return { ok: false, status: 400, error: 'Send the photo as a data URL in `image`.' };
  }
  if (image.length > MEAL_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error:
        'That photo is too large. Downscale it before sending — the client already does this at 1024 px.',
    };
  }
  if (!DATA_URL.test(image)) {
    return { ok: false, status: 400, error: '`image` must be a base64 image data URL.' };
  }
  return { ok: true, image, locale: resolveLocale(typeof locale === 'string' ? locale : null) };
}

/**
 * The vision request body.
 *
 * `image_url` with a data URL is the OpenAI-compatible image shape; Gemini's
 * compatibility layer and OpenRouter both accept it, which keeps this route as
 * provider-agnostic as `/api/coach`.
 */
export function buildVisionRequest(
  cfg: ServerAiConfig,
  image: string,
  locale: string,
): Record<string, unknown> {
  return {
    model: readVisionModel(cfg),
    temperature: 0.1,
    max_tokens: 600,
    stream: false,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildMealScanPrompt(locale) },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
  };
}

/** Providers put the useful message (quota reached, bad model) in the body. */
export function extractProviderError(text: string): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const message =
      typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? parsed.message);
    if (message) return message.slice(0, 220);
  } catch {
    return text.slice(0, 220);
  }
  return '';
}
