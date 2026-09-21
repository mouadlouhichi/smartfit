/**
 * "New deployment shipped while this tab was open" — detection and recovery.
 *
 * Vercel (and any host) serves each deployment's `/_next/static/**` chunks
 * under content-hashed names, and a deployment never has another build's
 * hashes. A tab left open across a redeploy keeps running the previous
 * build's code; its next client-side navigation asks for an old-hash chunk,
 * the new deployment answers 404 (as `text/plain`, so the browser also
 * refuses it on MIME grounds), and React's router surfaces a ChunkLoadError.
 *
 * The cure is a fresh page load: new HTML references the chunks that exist
 * on the current deployment. `reset()` cannot help — it re-renders the same
 * stale tree. The boundaries therefore reload **once per session** on such
 * errors; if the error survives a fresh load, something else is broken and
 * the normal fatal screen takes over.
 */

const CHUNK_ERROR = /Loading (?:CSS )?chunk \d+ failed/i;

/** True when the error means "this tab predates the current deployment". */
export function isStaleDeploymentError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message);
}

const RETRY_FLAG = 'smartfit:chunk-reloaded';

/**
 * Reload the page for a new deployment, at most once per session.
 *
 * @returns true when a reload was kicked off; false when it was already
 * tried (or storage is unavailable and the window-level guard tripped) —
 * the caller then shows the ordinary error screen instead of looping.
 */
export function reloadForNewDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RETRY_FLAG)) return false;
    sessionStorage.setItem(RETRY_FLAG, '1');
  } catch {
    // Private browsing may refuse storage; a window flag is a good-enough
    // backstop against a reload loop.
    const w = window as typeof window & { __smartfitChunkReload?: boolean };
    if (w.__smartfitChunkReload) return false;
    w.__smartfitChunkReload = true;
  }
  window.location.reload();
  return true;
}
