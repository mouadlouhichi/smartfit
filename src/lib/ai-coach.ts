import { env } from './env';
import {
  aggregate,
  bodyDisplayUnit,
  bodyValueToDisplay,
  categoryById,
  currentStreak,
  formatDistance,
  getPlan,
  goalProgress,
  GOAL_METRIC_META,
  round,
  sessionsInRange,
  startOfWeek,
  toISODate,
  weekStartOf,
} from '@smartfit/core';
import type { FitnessState } from '@smartfit/core';

/**
 * Optional AI answers for the coach, via any OpenAI-compatible
 * chat-completions endpoint.
 *
 * Two transports, preferred in this order:
 *
 *  1. **proxy** — `POST /api/coach` on this deployment. The provider key lives
 *     in a server-only env var (`AI_COACH_API_KEY`), so nothing secret ever
 *     reaches the browser bundle. This is the mode to use for anything public.
 *  2. **direct** — the legacy `NEXT_PUBLIC_AI_*` endpoint called straight from
 *     the browser. Kept for local/BYO-key setups (e.g. Ollama on
 *     `http://localhost:11434/v1`); a `NEXT_PUBLIC_` key is public by
 *     definition, so never put a shared secret there.
 *
 * Either way the athlete must also switch "AI answers" on, and the
 * deterministic on-device engine in `@smartfit/core` stays the default and the
 * fallback.
 *
 * Privacy stance: the request carries a compact *summary* of training data
 * (weekly totals, streak, goal progress, last few session titles, latest
 * weight) — never the raw export, never credentials, never the user's email.
 */

export class CoachAiError extends Error {
  override name = 'CoachAiError';
}

export interface AiCoachConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

/** True when a direct endpoint is configured — the UI shows the AI toggle then. */
export function aiCoachEnabled(cfg: AiCoachConfig = env.ai): boolean {
  return /^https?:\/\/\S+$/i.test(cfg.endpoint.trim());
}

/** Display host of the configured provider, for the privacy note. */
export function aiHost(cfg: AiCoachConfig = env.ai): string {
  try {
    return new URL(cfg.endpoint.trim()).host;
  } catch {
    return '';
  }
}

/**
 * The coach's voice. Deliberately short and structured — it answers as a
 * coach, not as a chatbot — but no longer a hard word ceiling: GPT-like
 * conversations need room for a two-part answer, and the model is allowed
 * light markdown (bullets and bold) because the UI renders it.
 */
export const SYSTEM_PROMPT = [
  'You are the SmartFit Coach: a warm, direct, practical training coach.',
  'Answer in plain conversational prose — usually 2-5 short sentences. Go longer only when the',
  'question genuinely needs steps or options, and never pad.',
  'Light markdown is allowed and rendered: "-" bullets, **bold** for the key number or action, and',
  'blank lines between paragraphs. No headings, no tables, no code blocks, no emoji.',
  'Base every answer on the athlete context provided; never invent workouts they did not log, and',
  'say plainly when the data does not answer the question.',
  'Use their units exactly as given in the context.',
  'When the question is about what to do next, give one clear recommendation plus one small why,',
  'and connect it to their streak, goals and recent load: if they trained hard recently, prioritise',
  'recovery; if they are behind a goal, propose the smallest concrete step that fits today.',
  'If they ask for something you cannot know (a lab result, a diagnosis, what a different app',
  'recorded), say so instead of guessing.',
  'You are not a doctor: no diagnoses, no medication or injury-treatment advice; persistent pain',
  'means a professional.',
].join(' ');

/** The single system message both transports send (server builds it too). */
export function buildSystemMessage(context: string): string {
  return `${SYSTEM_PROMPT}\n\nAthlete context (from their own device):\n${context}`;
}

/** Caps that keep a runaway conversation from becoming a runaway bill. */
export const COACH_MAX_TURNS = 8;
export const COACH_MAX_TURN_CHARS = 1200;
export const COACH_MAX_CONTEXT_CHARS = 4000;
export const COACH_MAX_QUESTION_CHARS = 1500;

export interface CoachTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Keep the tail of the conversation, in order, with every turn bounded.
 * Oldest turns fall off first: the last exchange is what makes a follow-up
 * ("and tomorrow?") answerable, and long quotes are what blow up a free tier.
 */
export function trimCoachTurns(turns: CoachTurn[], max = COACH_MAX_TURNS): CoachTurn[] {
  return turns
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && t.content.trim().length > 0)
    .slice(-max)
    .map((t) => ({
      role: t.role,
      content:
        t.content.length > COACH_MAX_TURN_CHARS
          ? `${t.content.slice(0, COACH_MAX_TURN_CHARS - 1)}…`
          : t.content,
    }));
}

/**
 * Validate a `/api/coach` request body. Pure so the route can stay thin and
 * the rules stay unit-tested.
 *
 * A client may only send `user`/`assistant` turns: the system prompt (and the
 * athlete context inside it) is assembled server-side, so a hostile caller
 * cannot turn the proxy into a general-purpose LLM gateway.
 */
export function parseCoachRequest(
  raw: unknown,
):
  | { ok: true; messages: CoachTurn[]; context: string }
  | { ok: false; status: number; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, status: 400, error: 'Expected a JSON object.' };
  }
  const body = raw as { messages?: unknown; context?: unknown };
  if (!Array.isArray(body.messages)) {
    return { ok: false, status: 400, error: 'messages must be an array.' };
  }
  const messages: CoachTurn[] = [];
  for (const entry of body.messages) {
    if (typeof entry !== 'object' || entry === null) {
      return { ok: false, status: 400, error: 'Each message must be an object.' };
    }
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, status: 400, error: 'Only user and assistant roles are accepted.' };
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, status: 400, error: 'Each message needs text.' };
    }
    if (content.length > COACH_MAX_TURN_CHARS) {
      messages.push({
        role,
        content: `${content.slice(0, COACH_MAX_TURN_CHARS - 1)}…`,
      });
    } else {
      messages.push({ role, content });
    }
  }
  if (messages.length === 0) {
    return { ok: false, status: 400, error: 'Send at least one message.' };
  }
  if (messages[messages.length - 1].role !== 'user') {
    return { ok: false, status: 400, error: 'The last message must come from the athlete.' };
  }
  const context =
    typeof body.context === 'string' ? body.context.slice(0, COACH_MAX_CONTEXT_CHARS) : '';
  return { ok: true, messages: trimCoachTurns(messages), context };
}

/**
 * Pull the text out of one provider payload. Supports the OpenAI delta shape,
 * a full non-streaming message, and Gemini's native `candidates` shape, so any
 * of the free endpoints in `.env.example` works without a code change.
 */
export function deltaText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const p = payload as {
    choices?: {
      delta?: { content?: unknown };
      message?: { content?: unknown };
      text?: unknown;
    }[];
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    content?: unknown;
  };
  const fromParts = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((part) =>
          typeof part === 'string' ? part : ((part as { text?: unknown })?.text ?? ''),
        )
        .filter((t): t is string => typeof t === 'string')
        .join('');
    }
    return '';
  };

  const choice = p.choices?.[0];
  if (choice) {
    const delta = fromParts(choice.delta?.content);
    if (delta) return delta;
    const message = fromParts(choice.message?.content);
    if (message) return message;
    if (typeof choice.text === 'string') return choice.text;
    return '';
  }
  const parts = p.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return fromParts(parts);
  return fromParts(p.content);
}

const DONE = /^\[done\]$/i;

/**
 * Read a response body as a stream of text deltas.
 *
 * Handles an SSE body (`data: {...}` lines, comments, `[DONE]`, events split
 * across chunk boundaries and payloads split across lines) and falls back to
 * parsing a single JSON (or plain text) body for providers that ignore
 * `stream: true`.
 */
export async function* streamDeltas(
  res: Response,
  /** Cancels a stalled body: aborting `fetch` alone does not reliably unblock
   *  a reader that is parked on `read()`. */
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const type = res.headers?.get?.('content-type')?.toLowerCase() ?? '';
  const body = res.body;
  if (
    !body ||
    typeof body.getReader !== 'function' ||
    (!type.includes('event-stream') && type.includes('json'))
  ) {
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const only = deltaText(parsed);
      if (only.trim()) yield only;
      return;
    } catch {
      /* not JSON — a plain-text endpoint is fine too */
    }
    if (!trimmed.startsWith('data:')) yield trimmed;
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  /** First bytes decide SSE vs. a single JSON body on a plain stream. */
  let sawEvent = type.includes('event-stream');

  let onAbort: (() => void) | null = null;
  /** `reader.cancel()` also resolves the pending read, so the flag — not the
   *  race — decides whether this was an abort or a clean end of stream. */
  let cancelled = false;
  const aborted = signal
    ? new Promise<never>((_, reject) => {
        onAbort = () => {
          cancelled = true;
          void reader.cancel().catch(() => undefined);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      })
    : null;

  try {
    for (;;) {
      const read = await (aborted ? Promise.race([reader.read(), aborted]) : reader.read());
      if (cancelled) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = read;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!sawEvent && /(^|\n)\s*data:/.test(buffer)) sawEvent = true;
      if (!sawEvent) continue;

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        const delta = readLine(line);
        if (delta === null) return; // [DONE]
        if (delta) yield delta;
        newline = buffer.indexOf('\n');
      }
    }
    // A final line without a trailing newline still counts.
    if (sawEvent && buffer.trim()) {
      const delta = readLine(buffer.replace(/\r$/, ''));
      if (delta) yield delta;
    } else if (!sawEvent && buffer.trim()) {
      const trimmed = buffer.trim();
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const only = deltaText(parsed);
        if (only.trim()) yield only;
      } catch {
        yield trimmed;
      }
    }
  } finally {
    if (onAbort && signal) signal.removeEventListener('abort', onAbort);
    reader.releaseLock?.();
  }
}

/** One SSE line → text, `null` for the terminating `[DONE]`, `''` to skip. */
function readLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return '';
  if (!trimmed.toLowerCase().startsWith('data:')) return '';
  const payload = trimmed.slice(5).trim();
  if (!payload) return '';
  if (DONE.test(payload)) return null;
  try {
    return deltaText(JSON.parse(payload) as unknown);
  } catch {
    return ''; // a malformed event must not kill the stream
  }
}

/** Collect a delta stream into one answer — the non-streaming convenience path. */
export async function collectStream(stream: AsyncGenerator<string, void, void>): Promise<string> {
  let text = '';
  for await (const delta of stream) text += delta;
  return text.trim();
}

/** Where the next answer should go. */
export type CoachTransport = 'proxy' | 'direct' | 'none';

export interface CoachAvailability {
  available: boolean;
  transport: CoachTransport;
  /** Upstream provider host, for the honest privacy note. */
  host: string;
  model: string;
}

export const COACH_PROXY_PATH = '/api/coach';

let probe: Promise<CoachAvailability> | null = null;

/**
 * Ask this deployment's own proxy whether it is configured, and fall back to a
 * direct public endpoint when it is not. Probed once per session — the answer
 * only changes when the deployment does.
 */
export function resolveCoachAvailability(
  fetchImpl: typeof fetch = fetch,
  /** Test seam — production always uses the build-time env. */
  cfg: AiCoachConfig = env.ai,
): Promise<CoachAvailability> {
  if (probe) return probe;
  probe = (async (): Promise<CoachAvailability> => {
    try {
      const res = await fetchImpl(COACH_PROXY_PATH, { headers: { accept: 'application/json' } });
      if (res.ok) {
        const info = (await res.json()) as { configured?: boolean; host?: string; model?: string };
        if (info.configured) {
          return {
            available: true,
            transport: 'proxy',
            host: info.host ?? '',
            model: info.model ?? '',
          };
        }
      }
    } catch {
      /* no proxy (static hosting / offline) — fall through to direct mode */
    }
    if (aiCoachEnabled(cfg)) {
      return { available: true, transport: 'direct', host: aiHost(cfg), model: cfg.model };
    }
    return { available: false, transport: 'none', host: '', model: '' };
  })();
  return probe;
}

/** Test seam: forget the cached probe. */
export function resetCoachAvailability(): void {
  probe = null;
}

/** No bytes within this window means "dead endpoint", not "slow thinker". */
const FIRST_TOKEN_MS = 20_000;
/** Hard ceiling for one answer, however chatty the provider is. */
const STREAM_CEILING_MS = 90_000;

export interface StreamCoachOptions {
  /** Prior turns, oldest first (the question itself is appended). */
  history?: CoachTurn[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Override the resolved transport (tests / explicit mode switches). */
  transport?: CoachTransport;
  cfg?: AiCoachConfig;
  /** Test seam for the dead-endpoint watchdog. */
  firstTokenMs?: number;
}

/**
 * Ask the AI coach and yield its answer as it arrives.
 *
 * Throws `CoachAiError` on any failure — including a first-token timeout —
 * so the caller can degrade to the on-device engine with an honest note.
 */
export async function* streamAiCoach(
  question: string,
  state: FitnessState,
  opts: StreamCoachOptions = {},
): AsyncGenerator<string, void, void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const cfg = opts.cfg ?? env.ai;
  const transport = opts.transport ?? (await resolveCoachAvailability(fetchImpl)).transport;
  if (transport === 'none') throw new CoachAiError('AI coach is not configured.');

  const turns = trimCoachTurns([
    ...(opts.history ?? []),
    { role: 'user', content: question.slice(0, COACH_MAX_QUESTION_CHARS) },
  ]);
  const context = buildCoachContext(state);

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstToken = true;
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
  };
  const onExternalAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onExternalAbort, { once: true });
  arm(opts.firstTokenMs ?? FIRST_TOKEN_MS);

  try {
    const res =
      transport === 'proxy'
        ? await fetchImpl(COACH_PROXY_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: turns, context }),
            signal: controller.signal,
          })
        : await fetchImpl(completionsUrl(cfg), {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: buildSystemMessage(context) },
                ...turns.map((t) => ({ role: t.role, content: t.content })),
              ],
              temperature: 0.6,
              max_tokens: 700,
              stream: true,
              ...(cfg.model ? { model: cfg.model } : {}),
            }),
            signal: controller.signal,
          });

    if (!res.ok) {
      const detail = await readError(res);
      throw new CoachAiError(detail || `AI request failed (${res.status}).`);
    }

    for await (const delta of streamDeltas(res, controller.signal)) {
      if (firstToken) {
        firstToken = false;
        arm(STREAM_CEILING_MS);
      }
      yield delta;
    }
  } catch (e) {
    if (e instanceof CoachAiError) throw e;
    if (timedOut) throw new CoachAiError('The AI service took too long to respond.');
    // DOMException is not an Error subclass everywhere, so check by name.
    if ((e as { name?: string } | null)?.name === 'AbortError') {
      throw new CoachAiError('The AI answer was stopped.');
    }
    throw new CoachAiError('Could not reach the AI service.');
  } finally {
    if (timer) clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Providers put their real message (quota, bad model) in the error body. */
async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string } | string;
        message?: string;
      };
      const message =
        typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? parsed.message);
      if (message) return truncate(`${message} (${res.status})`, 220);
    } catch {
      return truncate(`${text} (${res.status})`, 220);
    }
  } catch {
    /* body already consumed or unreadable */
  }
  return '';
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * A compact, deterministic summary of the athlete's own data — the ONLY
 * training information ever sent to an AI provider (and only when they
 * explicitly switched AI answers on).
 */
export function buildCoachContext(state: FitnessState, now = new Date()): string {
  const ws = weekStartOf(state);
  const weekFrom = startOfWeek(now, ws);
  const week = aggregate(sessionsInRange(state, toISODate(weekFrom), toISODate(now)));
  const plan = getPlan(state.profile.planId);
  const streak = currentStreak(state);
  const du = state.profile.distanceUnit;

  const lines: string[] = [
    `Plan: ${plan.name} (${plan.sessionsPerWeek} sessions/week).`,
    `Today's planned focus: ${plan.split.find((s) => s.weekday === now.getDay())?.focus ?? 'rest / free choice'}.`,
    `This week so far: ${week.workouts} workout${week.workouts === 1 ? '' : 's'}, ${week.minutes} min, ${week.calories} kcal` +
      (week.distance > 0 ? `, ${formatDistance(week.distance, du)}` : '') +
      '.',
    `Current streak: ${streak} day(s).`,
    `Units: distance in ${du}, weight in ${state.profile.weightUnit}.`,
  ];

  if (state.goals.length > 0) {
    lines.push(
      'Goals: ' +
        state.goals
          .slice(0, 6)
          .map((g) => {
            const p = goalProgress(state, g, now);
            return `"${g.name}" (${GOAL_METRIC_META[g.metric]?.label ?? g.metric}, ${g.cadence}) ${p.current}/${p.target}${p.done ? ' — DONE' : ` — ${Math.round(p.pct)}%`}`;
          })
          .join('; ') +
        '.',
    );
  }

  if (state.sessions.length > 0) {
    lines.push(
      'Recent sessions: ' +
        state.sessions
          .slice(0, 5)
          .map((s) => {
            const cat = categoryById(state, s.categoryId).name;
            const dist = s.distanceKm !== undefined ? `, ${formatDistance(s.distanceKm, du)}` : '';
            return `${s.date} "${s.title}" (${cat}, ${s.durationMin} min, ${s.intensity}${dist})`;
          })
          .join('; ') +
        '.',
    );
  }

  const weights = state.bodyLogs
    .filter((l) => l.unit === 'weight')
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (weights.length > 0) {
    const w = weights[0];
    lines.push(
      `Latest weight: ${round(bodyValueToDisplay(w.value, w.unit, state.profile), 1)} ${bodyDisplayUnit('weight', state.profile)} on ${w.date}.`,
    );
  }

  return lines.join('\n');
}

/** Normalise an env endpoint to the OpenAI-compatible chat-completions URL. */
export function completionsUrl(cfg: AiCoachConfig = env.ai): string {
  const base = cfg.endpoint.trim().replace(/\/+$/, '');
  return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
}
