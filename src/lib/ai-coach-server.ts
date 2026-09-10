/**
 * Server-only configuration for the coach proxy (`/api/coach`).
 *
 * This module reads secrets, so it must only ever be imported from a route
 * handler or other server code — never from a component. Next.js inlines
 * `NEXT_PUBLIC_*` into the browser bundle; everything else stays on the server.
 */

export interface ServerAiConfig {
  /** Upstream OpenAI-compatible base URL (…/v1), without /chat/completions. */
  endpoint: string;
  apiKey: string;
  model: string;
}

const PLAUSIBLE = /^https?:\/\/\S+$/i;

/**
 * The proxy is active only when `AI_COACH_ENDPOINT` is set: an explicit,
 * server-side decision. The legacy `NEXT_PUBLIC_AI_*` pair keeps working, but
 * stays a *browser* transport (that is what makes "point it at my own Ollama on
 * localhost" work), so a deployment that only sets the public variables is not
 * silently routed through the server.
 */
export function readServerAiConfig(): ServerAiConfig | null {
  const endpoint = process.env.AI_COACH_ENDPOINT?.trim() ?? '';
  if (!PLAUSIBLE.test(endpoint)) return null;
  return {
    endpoint,
    apiKey: process.env.AI_COACH_API_KEY?.trim() ?? '',
    model: process.env.AI_COACH_MODEL?.trim() ?? '',
  };
}

/** Upstream host, for the coach's honest "sent to …" note. */
export function serverAiHost(cfg: ServerAiConfig): string {
  try {
    return new URL(cfg.endpoint).host;
  } catch {
    return '';
  }
}

/** The chat-completions URL for a base endpoint, or the endpoint as-is. */
export function serverCompletionsUrl(cfg: ServerAiConfig): string {
  const base = cfg.endpoint.replace(/\/+$/, '');
  return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
}

/**
 * First token within this window, or the upstream is treated as dead.
 * The route arms the first-token window and then the ceiling below, so the
 * worst case one request can hold a function open is the sum of the two —
 * keep that under the platform limit (`maxDuration` in the route) so the route
 * ends a slow answer itself instead of being killed mid-stream.
 */
export const UPSTREAM_FIRST_TOKEN_MS = 18_000;
/** Hard ceiling for one upstream answer (see the note above). */
export const UPSTREAM_CEILING_MS = 40_000;

/** Timeout for the `?check=1` diagnostic ping — it is a health probe, not a chat. */
export const DIAGNOSTIC_TIMEOUT_MS = 12_000;

/**
 * Which HTTP status to hand back for a provider rejection.
 *
 * This used to collapse everything to 502, which made a wrong API key look
 * like a broken gateway in the browser console (`POST /api/coach 502`) and hid
 * the provider's own explanation from whoever was debugging the deployment.
 * A provider's 4xx is the caller's problem and is passed through verbatim;
 * 429 keeps its meaning (quota); anything genuinely upstream (5xx, unreadable)
 * stays a 502.
 */
export function providerHttpStatus(upstreamStatus: number): number {
  if (upstreamStatus === 429) return 429;
  if (upstreamStatus >= 400 && upstreamStatus < 500) return upstreamStatus;
  return 502;
}

/** Requests one caller (IP) may make in the window below. */
export const COACH_RATE_MAX = 20;
export const COACH_RATE_WINDOW_MS = 5 * 60_000;
