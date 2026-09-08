/**
 * Minimal, privacy-preserving diagnostics.
 *
 * Off by default: with no `NEXT_PUBLIC_ERROR_ENDPOINT` configured, nothing is
 * collected and nothing leaves the browser — which is what keeps the privacy
 * policy's promise true. When a deployment points the variable at a
 * self-hosted collector (GlitchTip/Sentry, a log sink, a Vercel function…),
 * crash reports and web-vital measurements are POSTed as plain JSON: no
 * cookies, no third-party SDK, no user identifiers, no query strings.
 */

const MAX_MESSAGE = 300;
const MAX_STACK = 4000;

export interface DiagnosticEvent {
  /** Where it came from: 'route', 'window.error', 'unhandledrejection', 'vital'… */
  scope: string;
  message: string;
  stack?: string;
  /** Pathname only — query strings can carry personal data. */
  path?: string;
  ts: number;
  extra?: Record<string, unknown>;
}

/** The configured collector, or '' when diagnostics are disabled. */
export function collectorUrl(): string {
  return process.env.NEXT_PUBLIC_ERROR_ENDPOINT?.trim() ?? '';
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Build the payload. Pure (apart from reading `location`) so it is testable. */
export function buildDiagnostic(
  scope: string,
  error: unknown,
  extra?: Record<string, unknown>,
): DiagnosticEvent {
  const err = error instanceof Error ? error : null;
  const message = clip(
    err?.message ||
      (typeof error === 'string' ? error : '') ||
      safeStringify(error ?? 'Unknown error'),
    MAX_MESSAGE,
  );
  const event: DiagnosticEvent = { scope, message, ts: Date.now() };
  if (err?.stack) event.stack = clip(err.stack, MAX_STACK);
  if (typeof window !== 'undefined') event.path = window.location.pathname;
  if (extra) event.extra = extra;
  return event;
}

/** Fire-and-forget delivery. Must never throw, never block, never retry. */
export function reportDiagnostic(event: DiagnosticEvent): void {
  const url = collectorUrl();
  if (!url || typeof window === 'undefined') return;
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true, // survives the page teardown that a crash may cause
      mode: 'cors',
    }).catch(() => undefined);
  } catch {
    /* a failed report must never become the next error */
  }
}

export function reportError(scope: string, error: unknown, extra?: Record<string, unknown>): void {
  reportDiagnostic(buildDiagnostic(scope, error, extra));
}
