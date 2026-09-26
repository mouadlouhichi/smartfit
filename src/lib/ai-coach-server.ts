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

/**
 * Why a configured endpoint cannot work from a deployed function.
 *
 * The single most common way this breaks: someone points `AI_COACH_ENDPOINT`
 * at a model running on their own machine (`http://localhost:11434/v1`) and
 * the serverless function dutifully tries to call itself. The request dies as
 * a generic "could not reach the provider", which is impossible to diagnose
 * from a browser console — so say it outright instead.
 */
export function endpointProblem(endpoint: string): string | null {
  let host: string;
  try {
    host = new URL(endpoint).hostname.toLowerCase();
  } catch {
    return 'is not a valid URL.';
  }

  const loopback =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1';
  const mdns = host.endsWith('.local');
  const privateV4 =
    /^(?:10|127)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
    host === '0.0.0.0';

  if (loopback || mdns || privateV4) {
    return (
      `points at "${host}", which only exists on your own machine — this server cannot reach it. ` +
      'Point AI_COACH_ENDPOINT at a hosted provider, or run the model locally and use the ' +
      'browser-side NEXT_PUBLIC_AI_* mode instead (that one is called by your computer, not by the deployment).'
    );
  }
  return null;
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
 * Model id for the image paths (`/api/meal-scan`, coach photos).
 *
 * A chat model and a vision model are usually not the same id, and silently
 * sending a JPEG to a text-only model produces a provider error that reads
 * like our bug. `AI_VISION_MODEL` overrides for images only; unset falls back
 * to the chat model, which is right for the many multimodal endpoints where
 * one id does both.
 */
export function readVisionModel(cfg: ServerAiConfig): string {
  return process.env.AI_VISION_MODEL?.trim() || cfg.model;
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
