import { buildSystemMessage, parseCoachRequest } from '@/lib/ai-coach';
import {
  COACH_RATE_MAX,
  COACH_RATE_WINDOW_MS,
  UPSTREAM_CEILING_MS,
  UPSTREAM_FIRST_TOKEN_MS,
  readServerAiConfig,
  serverAiHost,
  serverCompletionsUrl,
} from '@/lib/ai-coach-server';
import { createRateLimiter } from '@/lib/rate-limit';

/**
 * The coach proxy.
 *
 * Holds the provider key server-side so the browser never sees it, and streams
 * the answer straight through as it arrives. The client sends only its turns
 * and the compact athlete summary — the system prompt is assembled *here*, so
 * this cannot be used as a general-purpose LLM gateway.
 *
 * `GET` reports whether a provider is configured (plus its host, for the
 * coach's privacy note); no secret is ever returned.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Best-effort per-instance throttle; see `rate-limit.ts` for the caveats. */
const limiter = createRateLimiter({ max: COACH_RATE_MAX, windowMs: COACH_RATE_WINDOW_MS });

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(): Promise<Response> {
  const cfg = readServerAiConfig();
  return json(
    cfg ? { configured: true, host: serverAiHost(cfg), model: cfg.model } : { configured: false },
  );
}

/** Same-origin guard: a request with an Origin must come from this host. */
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
  if (!cfg) return json({ error: 'AI coach is not configured on this deployment.' }, 503);

  if (!sameOrigin(req)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);

  if (!limiter.allow(callerKey(req))) {
    return json({ error: 'Too many coach requests — try again in a few minutes.' }, 429);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const parsed = parseCoachRequest(raw);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), ms);
  };
  arm(UPSTREAM_FIRST_TOKEN_MS);

  let upstream: Response;
  try {
    upstream = await fetch(serverCompletionsUrl(cfg), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: buildSystemMessage(parsed.context || 'No athlete context was provided.'),
          },
          ...parsed.messages,
        ],
        temperature: 0.6,
        max_tokens: 700,
        stream: true,
        ...(cfg.model ? { model: cfg.model } : {}),
      }),
      signal: controller.signal,
    });
  } catch {
    if (timer) clearTimeout(timer);
    return json({ error: 'Could not reach the AI provider.' }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    if (timer) clearTimeout(timer);
    const detail = await upstream.text().catch(() => '');
    const message = `${extractError(detail) || 'The AI provider refused the request.'} (${upstream.status})`;
    return json(
      { error: message, providerStatus: upstream.status },
      upstream.status === 429 ? 429 : 502,
    );
  }

  const reader = upstream.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (timer) clearTimeout(timer);
          ctrl.close();
          return;
        }
        // Bytes are flowing: the provider is alive, so switch to the ceiling.
        arm(UPSTREAM_CEILING_MS);
        ctrl.enqueue(value);
      } catch (e) {
        if (timer) clearTimeout(timer);
        ctrl.error(e);
      }
    },
    cancel() {
      if (timer) clearTimeout(timer);
      controller.abort();
      void reader.cancel().catch(() => undefined);
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'cache-control': 'no-store',
      // Tells reverse proxies (nginx, some serverless edges) not to buffer the
      // stream — buffering would defeat the whole point of streaming.
      'x-accel-buffering': 'no',
    },
  });
}

/** Providers put the useful message (quota reached, bad model) in the body. */
function extractError(text: string): string {
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
