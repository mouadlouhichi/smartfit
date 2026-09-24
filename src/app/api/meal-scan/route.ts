import {
  MEAL_SCAN_RATE_MAX,
  MEAL_SCAN_RATE_WINDOW_MS,
  mealScanFromItems,
  parseRecognizedItems,
} from '@smartfit/core';
import {
  DIAGNOSTIC_TIMEOUT_MS,
  endpointProblem,
  providerHttpStatus,
  readServerAiConfig,
  readVisionModel,
  serverCompletionsUrl,
  serverAiHost,
} from '@/lib/ai-coach-server';
import {
  buildVisionRequest,
  extractProviderError,
  parseMealScanRequest,
} from '@/lib/meal-scan-server';
import { createRateLimiter } from '@/lib/rate-limit';

/**
 * Food photo → macro estimate.
 *
 * The sibling of `/api/coach`, and it follows the same rules: the provider key
 * stays server-side, the client posts to this app's own route, and the request
 * is rate-limited per caller.
 *
 * One thing is deliberately different. The coach streams prose back; this
 * route returns *structure*. The model is only allowed to name foods and
 * portions (see `buildMealScanPrompt` in @smartfit/core) and this handler then
 * computes every calorie, protein, carb and fat value from `FOOD_DB` — the same
 * table the offline text scanner uses. A model that hallucinates "1 200 kcal"
 * cannot put 1 200 kcal in the athlete's log; the worst it can do is name the
 * wrong food, which the modal shows as a chip to correct before saving.
 *
 * There is no offline fallback *here* — a route handler has no camera. The
 * client degrades to the on-device text parser, which is why the meal modal
 * still works with no provider configured at all.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** One non-streaming completion; generous enough for a slow free tier. */
export const maxDuration = 30;

const limiter = createRateLimiter({
  max: MEAL_SCAN_RATE_MAX,
  windowMs: MEAL_SCAN_RATE_WINDOW_MS,
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/** `GET` reports whether the photo path is live — no secret is ever returned. */
export async function GET(): Promise<Response> {
  const cfg = readServerAiConfig();
  if (!cfg) return json({ configured: false });
  const problem = endpointProblem(cfg.endpoint);
  if (problem)
    return json({ configured: true, ok: false, error: `AI_COACH_ENDPOINT ${problem}` }, 503);
  return json({
    configured: true,
    ok: true,
    host: serverAiHost(cfg),
    model: readVisionModel(cfg),
  });
}

/** Same-origin guard: a request carrying an Origin must come from this host. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // curl / native fetch — no browser confused-deputy risk
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function callerKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: Request): Promise<Response> {
  const cfg = readServerAiConfig();
  if (!cfg) {
    return json(
      {
        error: 'Photo scan is not configured on this deployment.',
        code: 'not-configured',
      },
      503,
    );
  }
  const problem = endpointProblem(cfg.endpoint);
  if (problem) {
    console.error(`[meal-scan] AI_COACH_ENDPOINT ${problem}`);
    return json({ error: `AI_COACH_ENDPOINT ${problem}`, code: 'bad-endpoint' }, 503);
  }

  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  if (!limiter.allow(callerKey(req))) {
    return json(
      { error: 'Too many photo scans — try again in a few minutes.', code: 'rate-limited' },
      429,
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const parsed = parseMealScanRequest(raw);
  if (!parsed.ok) return json({ error: parsed.error, code: 'bad-request' }, parsed.status);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIAGNOSTIC_TIMEOUT_MS + 8_000);
  let upstream: Response;
  try {
    upstream = await fetch(serverCompletionsUrl(cfg), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(buildVisionRequest(cfg, parsed.image, parsed.locale)),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as { name?: string } | null)?.name === 'AbortError';
    console.error(
      `[meal-scan] ${serverCompletionsUrl(cfg)} unreachable: ${e instanceof Error ? e.message : String(e)}`,
    );
    return json(
      {
        error: aborted
          ? 'The AI provider did not respond in time.'
          : 'Could not reach the AI provider from this deployment.',
        code: aborted ? 'timeout' : 'unreachable',
      },
      502,
    );
  }

  if (!upstream.ok) {
    clearTimeout(timer);
    const detail = await upstream.text().catch(() => '');
    const message = `${extractProviderError(detail) || 'The AI provider refused the request.'} (${upstream.status})`;
    console.error(`[meal-scan] ${serverCompletionsUrl(cfg)} → ${message}`);
    return json(
      { error: message, code: 'provider', providerStatus: upstream.status },
      providerHttpStatus(upstream.status),
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    clearTimeout(timer);
    return json(
      { error: 'The provider returned a body that was not JSON.', code: 'bad-response' },
      502,
    );
  } finally {
    clearTimeout(timer);
  }

  const items = parseRecognizedItems(payload, parsed.locale);
  if (items.length === 0) {
    // Not an error: a photo of an empty plate is a legitimate answer, and a
    // model that chatted instead of answering is the client's cue to fall back
    // to typing. Either way there is nothing to log.
    return json({
      items: [],
      scan: mealScanFromItems([]),
      empty: true,
      model: readVisionModel(cfg),
    });
  }

  // The macros are computed here, from our table, never taken from the model.
  const scan = mealScanFromItems(items, { locale: parsed.locale });
  return json({ items, scan, empty: false, model: readVisionModel(cfg) });
}
