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
 * chat-completions endpoint. Everything here is inert unless
 * `NEXT_PUBLIC_AI_ENDPOINT` is configured AND the athlete switches
 * "AI answers" on in the coach UI — the deterministic on-device engine in
 * `@smartfit/core` remains the default and the fallback.
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

/** True when an endpoint is configured — the UI shows the AI toggle then. */
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

const SYSTEM_PROMPT = [
  'You are the SmartFit Coach: a warm, direct, practical training coach.',
  'Answer in at most ~90 words of plain text (short sentences or a few dashes, no markdown headings).',
  'Base every answer on the athlete context provided; never invent workouts they did not log.',
  'Use their units exactly as given in the context.',
  'Give one clear recommendation plus one small why. Adjust for their streak, goals and recent load:',
  'if they trained hard recently, prioritise recovery; if they are behind a goal, propose the smallest',
  'concrete step that fits their plan today.',
  'You are not a doctor: no diagnoses, no medication or injury-treatment advice; persistent pain means a professional.',
].join(' ');

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

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Ask the configured provider. Throws `CoachAiError` on any failure — the
 * caller falls back to the on-device engine, so a dead endpoint degrades
 * gracefully instead of breaking the conversation.
 */
export async function askAiCoach(
  question: string,
  state: FitnessState,
  opts: { cfg?: AiCoachConfig; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const cfg = opts.cfg ?? env.ai;
  if (!aiCoachEnabled(cfg)) throw new CoachAiError('AI coach is not configured.');
  const fetchImpl = opts.fetchImpl ?? fetch;

  const body: Record<string, unknown> = {
    messages: [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\nAthlete context (from their own device):\n${buildCoachContext(state)}`,
      },
      { role: 'user', content: question },
    ],
    temperature: 0.6,
    max_tokens: 400,
  };
  if (cfg.model) body.model = cfg.model;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  opts.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const res = await fetchImpl(completionsUrl(cfg), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new CoachAiError(`AI request failed (${res.status}).`);
    const json = (await res.json()) as ChatResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new CoachAiError('AI response was empty.');
    return text;
  } catch (e) {
    if (e instanceof CoachAiError) throw e;
    throw new CoachAiError(
      e instanceof Error && e.name === 'AbortError'
        ? 'The AI service took too long to respond.'
        : 'Could not reach the AI service.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
