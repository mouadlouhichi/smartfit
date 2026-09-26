import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../src/app/api/meal-scan/route.ts';
import { parseMealScanRequest } from '../src/lib/meal-scan-server.ts';
import { readServerAiConfig, readVisionModel } from '../src/lib/ai-coach-server.ts';
import { MEAL_PHOTO_MAX_BYTES, emptyState, type FitnessState } from '@smartfit/core';

/**
 * The photo-scan proxy.
 *
 * Two things must hold no matter what the provider does:
 *
 *  1. **No key reaches the browser.** The route is the only thing that talks to
 *     the provider, and `GET` reports availability without ever echoing a
 *     secret.
 *  2. **Macros never come from the model.** The route computes them from
 *     `FOOD_DB`, so a model that invents "1 200 kcal" cannot write it into a
 *     log. That is the property most of these tests are about.
 */

const IMAGE = `data:image/jpeg;base64,${'A'.repeat(600)}`;

/** Minimal valid state for the request builder (unused by the route itself). */
const _state: FitnessState = emptyState();

function env(over: Record<string, string | undefined>) {
  const saved = { ...process.env };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const k of Object.keys(over)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

/* ── request validation ─────────────────────────────────────────────────── */

test('a valid image is accepted and the locale is resolved', () => {
  const ok = parseMealScanRequest({ image: IMAGE, locale: 'fr-MA' });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.locale, 'fr');

  const noLocale = parseMealScanRequest({ image: IMAGE });
  assert.equal(noLocale.ok, true);
  if (noLocale.ok) assert.equal(noLocale.locale, 'en');
});

test('anything that is not an image data URL is refused before the provider is called', () => {
  for (const image of [
    undefined,
    null,
    '',
    42,
    {},
    'https://example.com/lunch.jpg',
    'data:text/plain;base64,aGVsbG8=',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/jpeg;base64,not base64!!',
  ]) {
    const result = parseMealScanRequest({ image });
    assert.equal(result.ok, false, `accepted ${JSON.stringify(image)}`);
    if (!result.ok) assert.equal(result.status, 400);
  }
  assert.equal(parseMealScanRequest(null).ok, false);
  assert.equal(parseMealScanRequest('nope').ok, false);
});

test('an oversized photo is a 413, not a silent truncation', () => {
  const huge = `data:image/jpeg;base64,${'A'.repeat(MEAL_PHOTO_MAX_BYTES)}`;
  const result = parseMealScanRequest({ image: huge });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 413);
    assert.match(result.error, /too large/i);
  }
});

/* ── availability ───────────────────────────────────────────────────────── */

test('GET reports "not configured" without leaking anything', async () => {
  const restore = env({ AI_COACH_ENDPOINT: undefined, AI_VISION_MODEL: undefined });
  try {
    const res = await GET();
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.configured, false);
    // Nothing resembling a key, and no provider host either.
    assert.equal(body.host, undefined);
    assert.deepEqual(Object.keys(body), ['configured']);
  } finally {
    restore();
  }
});

test('GET names the vision model — and only ever the model', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'sk-secret-value',
    AI_COACH_MODEL: 'chat-model',
    AI_VISION_MODEL: 'vision-model',
  });
  try {
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.configured, true);
    assert.equal(body.model, 'vision-model');
    assert.equal(body.host, 'api.example.com');
    const serialised = JSON.stringify(body);
    assert.ok(!serialised.includes('sk-secret-value'), 'the API key must never be serialised');
  } finally {
    restore();
  }
});

test('a loopback endpoint is refused with the reason, not a generic failure', async () => {
  const restore = env({ AI_COACH_ENDPOINT: 'http://localhost:11434/v1' });
  try {
    const res = await GET();
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? '', /AI_COACH_ENDPOINT/);
    assert.match(body.error ?? '', /only exists on your own machine/);
  } finally {
    restore();
  }
});

test('the vision model falls back to the chat model when unset', () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_MODEL: 'chat-model',
    AI_VISION_MODEL: undefined,
  });
  try {
    const cfg = readServerAiConfig()!;
    assert.equal(readVisionModel(cfg), 'chat-model');
  } finally {
    restore();
  }
});

/* ── POST ───────────────────────────────────────────────────────────────── */

test('POST without a configured provider answers 503 with a code the UI can act on', async () => {
  const restore = env({ AI_COACH_ENDPOINT: undefined });
  try {
    const res = await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        body: JSON.stringify({ image: IMAGE }),
      }),
    );
    assert.equal(res.status, 503);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, 'not-configured');
  } finally {
    restore();
  }
});

test('a cross-origin POST is refused (the proxy is not a public vision gateway)', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'k',
  });
  try {
    const res = await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify({ image: IMAGE }),
      }),
    );
    assert.equal(res.status, 403);
  } finally {
    restore();
  }
});

test('a bad body is refused before any provider call', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'k',
  });
  try {
    const res = await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        body: 'not json',
      }),
    );
    assert.equal(res.status, 400);
  } finally {
    restore();
  }
});

test('the route computes macros from our table, not from the model', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'k',
  });
  const realFetch = globalThis.fetch;
  // A provider that answers with the right shape but absurd macros: the route
  // must ignore everything except the identified foods and portions.
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [{ id: 'chicken', amount: 200, confidence: 0.9, calories: 99999 }],
                calories: 99999,
                note: 'trust me',
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const res = await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        headers: { host: 'localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ image: IMAGE }),
      }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      scan: { calories: number; protein: number; items: string[] };
      items: unknown[];
      empty: boolean;
    };
    assert.deepEqual(body.scan.items, ['chicken']);
    assert.equal(body.scan.calories, 330, '200 g of chicken is 330 kcal from FOOD_DB');
    assert.equal(body.scan.protein, 62);
    assert.ok(body.scan.calories < 1000, 'the model’s 99999 kcal must not survive');
  } finally {
    globalThis.fetch = realFetch;
    restore();
  }
});

test('an unidentified plate is an empty result, not an error', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'k',
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: 'I cannot tell what this is, sorry!' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const res = await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        headers: { host: 'localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ image: IMAGE }),
      }),
    );
    assert.equal(
      res.status,
      200,
      'prose instead of JSON is the client’s cue to fall back, not a 500',
    );
    const body = (await res.json()) as { empty: boolean; scan: { calories: number } };
    assert.equal(body.empty, true);
    assert.equal(body.scan.calories, 0);
  } finally {
    globalThis.fetch = realFetch;
    restore();
  }
});

test('a provider error is passed through with its own status and message', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'k',
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: 'model does not support images' } }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    const res = await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        headers: { host: 'localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ image: IMAGE }),
      }),
    );
    assert.equal(res.status, 400, 'a provider 4xx is the caller’s problem, not a bad gateway');
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /does not support images/);
  } finally {
    globalThis.fetch = realFetch;
    restore();
  }
});

test('the image the provider receives is the one that was posted', async () => {
  const restore = env({
    AI_COACH_ENDPOINT: 'https://api.example.com/v1',
    AI_COACH_API_KEY: 'k',
    AI_VISION_MODEL: 'vision-model',
  });
  const realFetch = globalThis.fetch;
  let seen: { model?: string; url?: string; prompt?: string } = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: { content: { type: string; text?: string; image_url?: { url: string } }[] }[];
    };
    seen = {
      model: body.model,
      url: body.messages[0].content.find((c) => c.type === 'image_url')?.image_url?.url,
      prompt: body.messages[0].content.find((c) => c.type === 'text')?.text,
    };
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await POST(
      new Request('http://localhost/api/meal-scan', {
        method: 'POST',
        headers: { host: 'localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ image: IMAGE, locale: 'fr' }),
      }),
    );
    assert.equal(seen.model, 'vision-model', 'the vision model is used, not the chat model');
    assert.equal(seen.url, IMAGE);
    assert.match(seen.prompt ?? '', /You do NOT compute calories/);
  } finally {
    globalThis.fetch = realFetch;
    restore();
  }
});
