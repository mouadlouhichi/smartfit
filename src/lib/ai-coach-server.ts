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

/** First token within this window, or the upstream is treated as dead. */
export const UPSTREAM_FIRST_TOKEN_MS = 25_000;
/** Hard ceiling for one upstream answer. */
export const UPSTREAM_CEILING_MS = 90_000;

/** Requests one caller (IP) may make in the window below. */
export const COACH_RATE_MAX = 20;
export const COACH_RATE_WINDOW_MS = 5 * 60_000;
