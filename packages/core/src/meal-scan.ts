/**
 * The contract between a food photo and the macro log.
 *
 * Design decision worth stating plainly, because it is the reason this file
 * exists at all: **the vision model never produces calories.** It is asked to
 * identify *which foods* are on the plate and *how much* of each, in units our
 * own table understands. Every number the athlete sees is then computed from
 * `FOOD_DB` — the same table the on-device text scanner uses, the same one the
 * swap list uses.
 *
 * That buys three things:
 *
 *  1. A model that hallucinates "1 200 kcal" cannot write 1 200 kcal into the
 *     log — the worst it can do is name the wrong food, which the UI shows as a
 *     chip the athlete can correct before saving.
 *  2. The photo path and the text path produce *identical* output shapes, so
 *     the meal modal has one code path and one set of tests.
 *  3. It works the same whether the identifier is a hosted vision model or, in
 *     the future, an on-device classifier.
 */
import {
  FOOD_DB,
  foodById,
  foodLabel,
  localizedFoodNames,
  type FoodEntry,
  totalsOfLines,
  type MealScan,
  type MealScanLine,
} from './nutrition';

/** One food the recogniser believes it saw, before any macro maths. */
export interface RecognizedItem {
  /** `FOOD_DB` id when the model picked from the list, else resolved by name. */
  id: string;
  /** How much of it: grams for per-100 g foods, units for countable ones. */
  amount: number;
  /** The recogniser's own confidence, 0–1. Shown, never used to hide anything. */
  confidence: number;
  /** What the model called it, kept for the "why this?" line in the UI. */
  asSeen?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A generous catalogue listing for the prompt: id + the names the model may
 * see. Kept compact (ids and a few names) because prompt length is the whole
 * cost of a vision call, and the model only needs to *choose*, not to know
 * nutrition.
 */
export function foodCatalogForPrompt(locale = 'en'): string {
  return FOOD_DB.map((f) => {
    const names = localizedFoodNames(f, locale).slice(0, 3).join(' / ');
    return `${f.id} (${names})`;
  }).join('\n');
}

/**
 * The instruction sent with the photo. It is intentionally strict JSON: the
 * parse below is unforgiving, and a model that chats instead of answering just
 * costs itself a retry rather than corrupting a log entry.
 */
export function buildMealScanPrompt(locale = 'en'): string {
  return [
    'You identify food in a photo and estimate portion size. You do NOT compute calories or macros.',
    'Reply with JSON only — no prose, no markdown fence — in exactly this shape:',
    '{"items":[{"id":"<catalog id>","amount":<number>,"confidence":<0-1>}],"note":"<optional, max 80 chars>"}',
    'Rules:',
    '- `id` MUST be one of the catalog ids below. If nothing in the catalog matches, omit the item rather than inventing an id.',
    '- `amount` is grams for foods measured per 100 g, and a count of units for countable foods (eggs, slices, scoops, glasses). Estimate generously but plausibly from the visible portion; when a scale or hand is not visible, assume a normal single serving.',
    '- At most 8 items, most prominent first. An empty plate is `{"items":[]}`.',
    '- Never add dietary or medical advice.',
    locale === 'en' ? '' : `- The athlete's interface language is "${locale}".`,
    '',
    'Catalog (id (names)):',
    foodCatalogForPrompt(locale),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Resolve a free-text food name to a catalog entry, aliases included. */
export function matchFoodName(name: string, locale = 'en'): FoodEntry | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  let best: { food: FoodEntry; len: number } | null = null;
  for (const food of FOOD_DB) {
    for (const candidate of localizedFoodNames(food, locale)) {
      const name = candidate.toLowerCase();
      if (needle === name || needle.includes(name) || name.includes(needle)) {
        if (!best || name.length > best.len) best = { food, len: name.length };
      }
    }
  }
  return best?.food ?? null;
}

/**
 * Normalise whatever the provider returned into `RecognizedItem[]`.
 *
 * Tolerates the shapes real endpoints produce (a bare array, `{items:[…]}`, an
 * OpenAI-style `choices[0].message.content` string holding JSON, a fenced code
 * block), drops anything that is not a known food, and clamps amounts to a
 * sane range. Unknown ids return an empty list rather than throwing — the
 * caller decides whether that is a failure.
 */
export function parseRecognizedItems(raw: unknown, locale = 'en'): RecognizedItem[] {
  const payload = unwrapProviderPayload(raw);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown })?.items)
      ? ((payload as { items: unknown[] }).items as unknown[])
      : [];

  const out: RecognizedItem[] = [];
  const seen = new Set<string>();
  const push = (id: string, e: RawItem, fallbackAmount: number, asSeen?: string) => {
    const food = foodById(id);
    if (!food || seen.has(food.id)) return;
    seen.add(food.id);
    const rawAmount = [e.amount, e.grams].find(
      (v) => typeof v === 'number' || typeof v === 'string',
    );
    const amount = Number(rawAmount);
    const value = Number.isFinite(amount) && amount > 0 ? amount : fallbackAmount;
    // Clamp per food type: nobody eats 5 kg of chicken, but a "chicken" read as
    // 5000 g would blow the day's targets in a single tap.
    const bounded = food.per === '100g' ? clamp(value, 10, 1000) : clamp(value, 0.5, 8);
    const confidence = Number(e.confidence);
    out.push({
      id: food.id,
      amount: Math.round(bounded * 10) / 10,
      confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5,
      asSeen: asSeen && asSeen !== food.id ? asSeen : undefined,
    });
  };

  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as RawItem;
    const rawId = typeof e.id === 'string' ? e.id.trim() : '';

    // `id` is a promise: the model was handed our catalog and picked from it,
    // so it has to match one exactly. Only a free-text `name`/`label` gets the
    // fuzzy resolver — otherwise an invented id like "unicorn-steak" would
    // sneak in as beef through the substring "steak", which is exactly the
    // kind of confident-but-wrong entry this design exists to prevent.
    if (rawId) {
      const food = foodById(rawId);
      if (!food) continue;
      push(food.id, e, food.per === '100g' ? 100 : 1);
    } else {
      const rawName = [e.name, e.label].find((v): v is string => typeof v === 'string');
      if (!rawName) continue;
      const food = matchFoodName(rawName, locale);
      if (!food) continue;
      push(food.id, e, food.per === '100g' ? 100 : 1, rawName);
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** The raw provider entry, before any validation. */
interface RawItem {
  id?: unknown;
  name?: unknown;
  label?: unknown;
  amount?: unknown;
  grams?: unknown;
  confidence?: unknown;
}

/** Dig the useful object out of the various provider envelopes. */
function unwrapProviderPayload(raw: unknown): unknown {
  if (typeof raw === 'string') return parseJsonLoose(raw);
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  // OpenAI-compatible: choices[0].message.content is a JSON *string*.
  const choice = Array.isArray(o.choices) ? (o.choices[0] as Record<string, unknown>) : undefined;
  const message = choice?.message as { content?: unknown } | undefined;
  const content = message?.content ?? choice?.text ?? o.content;
  if (typeof content === 'string') {
    const inner = parseJsonLoose(content);
    if (inner) return inner;
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part === 'string' ? part : ((part as { text?: string })?.text ?? '')))
      .join('');
    const inner = parseJsonLoose(text);
    if (inner) return inner;
  }
  // Gemini-native: candidates[0].content.parts[0].text
  const candidates = o.candidates;
  if (Array.isArray(candidates)) {
    const parts = (candidates[0] as { content?: { parts?: { text?: string }[] } })?.content?.parts;
    const text = (parts ?? []).map((p) => p.text ?? '').join('');
    const inner = parseJsonLoose(text);
    if (inner) return inner;
  }
  if (o.structured) return o.structured;
  return o;
}

/** JSON.parse that survives a markdown fence and trailing prose. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to the brace-hunting pass */
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Turn recognised items into the same `MealScan` the text parser returns.
 * Macros come from `FOOD_DB`, rounded like every other number in the app.
 */
export function mealScanFromItems(
  items: RecognizedItem[],
  opts: { name?: string; locale?: string } = {},
): MealScan {
  const lines: MealScanLine[] = [];

  for (const item of items) {
    const food = foodById(item.id);
    if (!food) continue;
    const factor = food.per === '100g' ? item.amount / 100 : item.amount;
    const label =
      food.per === '100g' ? `${Math.round(item.amount)} g` : `${item.amount} × ${food.unitLabel}`;
    lines.push({
      id: food.id,
      label: `${foodLabel(food, opts.locale)} ${label}`.trim(),
      calories: Math.round(food.kcal * factor),
      protein: Math.round(food.protein * factor),
      carbs: Math.round(food.carbs * factor),
      fat: Math.round(food.fat * factor),
    });
  }

  const ids = lines.map((l) => l.id);
  const fallbackName = ids
    .map((id) => foodLabel(id, opts.locale))
    .slice(0, 3)
    .join(', ');
  return {
    ...totalsOfLines(lines),
    name: (opts.name?.trim() || fallbackName || 'Photo meal').slice(0, 120),
    matched: lines.map((l) => l.label),
    items: ids,
    lines,
    empty: ids.length === 0,
  };
}

/** Largest photo accepted by the endpoint, as a data URL (base64 ≈ 4/3 bytes). */
export const MEAL_PHOTO_MAX_BYTES = 1_500_000;
/** Requests one caller (IP) may make per window — vision calls cost more. */
export const MEAL_SCAN_RATE_MAX = 12;
export const MEAL_SCAN_RATE_WINDOW_MS = 10 * 60_000;
