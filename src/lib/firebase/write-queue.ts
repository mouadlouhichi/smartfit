/**
 * A durable, serialised write queue for Firestore mutations.
 *
 * Cloud writes used to be fired as `void promise` with no error handling, so a
 * permissions error, an expired token or a dropped connection lost the record
 * silently while the UI happily showed it as saved. Every mutation now goes
 * through this queue, which:
 *
 *   - runs operations in order (so a delete can never overtake its create),
 *   - retries with exponential backoff,
 *   - collapses repeated writes to the same key while one is still pending,
 *   - reports its status so the UI can tell the user something is wrong,
 *   - and flushes automatically when the browser comes back online.
 *
 * Firestore's own IndexedDB cache already replays writes across reloads; this
 * layer exists so *application-level* failures (rules, auth, bad data) surface
 * instead of vanishing.
 */

export type SyncStatus = 'idle' | 'saving' | 'error';

export interface QueuedOp {
  /** Collapse key — a newer op with the same key replaces a pending one. */
  key: string;
  run: () => Promise<void>;
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;

type Listener = (status: SyncStatus, pending: number, error: string | null) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class WriteQueue {
  private queue: QueuedOp[] = [];
  private running = false;
  private status: SyncStatus = 'idle';
  private error: string | null = null;
  private listeners = new Set<Listener>();
  private onlineHandler: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        if (this.queue.length) void this.drain();
      };
      window.addEventListener('online', this.onlineHandler);
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status, this.queue.length, this.error);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.status, this.queue.length, this.error);
  }

  private setStatus(status: SyncStatus, error: string | null = null) {
    this.status = status;
    this.error = error;
    this.emit();
  }

  /** Queue a mutation. Ops sharing a key collapse to the most recent one. */
  push(op: QueuedOp) {
    const existing = this.queue.findIndex((q) => q.key === op.key);
    if (existing >= 0) this.queue[existing] = op;
    else this.queue.push(op);
    this.setStatus('saving');
    void this.drain();
  }

  /** Retry after a failure — used by the "try again" affordance. */
  retry() {
    if (this.queue.length) {
      this.setStatus('saving');
      void this.drain();
    } else {
      this.setStatus('idle');
    }
  }

  /**
   * Resolves once everything queued so far has been written — or once the
   * queue has parked on an error, so callers never hang on a permission
   * failure. Used where a navigation must not outrun its save.
   */
  flush(): Promise<void> {
    if (!this.queue.length && !this.running) return Promise.resolve();
    return new Promise((resolve) => {
      const off = this.subscribe((status, pending) => {
        if ((pending === 0 && !this.running) || status === 'error') {
          off();
          resolve();
        }
      });
    });
  }

  /** Drop everything pending (sign-out, account wipe). */
  clear() {
    this.queue = [];
    this.setStatus('idle');
  }

  get pending(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      while (this.queue.length) {
        const op = this.queue[0];
        let lastErr: unknown = null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            await op.run();
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) break;
            await sleep(BASE_DELAY_MS * 2 ** attempt);
          }
        }

        if (lastErr) {
          // Leave the op at the head of the queue so a retry (manual or on
          // reconnect) picks up exactly where we stopped.
          this.setStatus('error', describe(lastErr));
          this.running = false;
          return;
        }

        this.queue.shift();
        this.emit();
      }

      this.setStatus('idle');
    } finally {
      this.running = false;
      // Notify after the flag flips: flush() waiters observe the settled
      // queue, not a half-finished drain.
      this.emit();
    }
  }

  dispose() {
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
    }
    this.listeners.clear();
  }
}

function code(err: unknown): string {
  return (err as { code?: string })?.code ?? '';
}

/** Transient conditions worth retrying; permission errors are not. */
function isRetryable(err: unknown): boolean {
  const c = code(err);
  if (c === 'permission-denied' || c === 'unauthenticated' || c === 'invalid-argument')
    return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return (
    c === '' ||
    c === 'unavailable' ||
    c === 'deadline-exceeded' ||
    c === 'resource-exhausted' ||
    c === 'aborted' ||
    c === 'internal' ||
    c === 'cancelled'
  );
}

function describe(err: unknown): string {
  switch (code(err)) {
    case 'permission-denied':
      return "Your changes couldn't be saved — this account isn't allowed to write that data.";
    case 'unauthenticated':
      return 'Your session expired. Sign in again to save your changes.';
    case 'resource-exhausted':
      return 'The cloud quota for this project is exhausted. Changes are kept on this device.';
    case 'unavailable':
      return "Can't reach the cloud right now. Your changes are saved on this device and will sync automatically.";
    default:
      return "Some changes haven't synced yet. They're safe on this device — we'll keep trying.";
  }
}
