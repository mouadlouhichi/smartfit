import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
async function worker(path: string, mode: string, response: Response | null) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const writes: string[] = [];
  const waits: Promise<unknown>[] = [];
  let result: Promise<Response> | undefined;
  runInNewContext(code, {
    URL,
    Response,
    self: {
      location: { origin: 'https://smartfit.test' },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        (handlers[name] = handler),
    },
    fetch: async () => {
      if (!response) throw new Error('offline');
      return response;
    },
    caches: {
      match: async () => undefined,
      open: async () => ({ put: async () => writes.push(path) }),
    },
  });
  handlers.fetch({
    request: { url: `https://smartfit.test${path}`, method: 'GET', mode, headers: new Headers() },
    respondWith: (value: Promise<Response>) => (result = value),
    waitUntil: (value: Promise<unknown>) => waits.push(value),
  });
  const resolved = await result;
  await Promise.all(waits);
  return { writes, response: resolved };
}
test('private navigation HTML is network-only, not cached across sessions', async () => {
  const result = await worker(
    '/g/test-gym/console',
    'navigate',
    new Response('private', { headers: { 'Cache-Control': 'no-store' } }),
  );
  assert.equal(await result.response?.text(), 'private');
  assert.equal(result.writes.length, 0);
});
test('offline navigation falls back without serving old privileged HTML', async () => {
  const result = await worker('/admin', 'navigate', null);
  assert.equal(result.response?.status, 503);
  assert.equal(result.writes.length, 0);
});
test('static assets cache only successful public responses; APIs never enter the asset cache', async () => {
  assert.equal(
    (await worker('/api/private.png', 'cors', new Response('private'))).response,
    undefined,
  );
  assert.equal(
    (await worker('/images/test.webp', 'cors', new Response('missing', { status: 404 }))).writes
      .length,
    0,
  );
  assert.equal(
    (
      await worker(
        '/images/test.webp',
        'cors',
        new Response('private', { headers: { 'Cache-Control': 'private' } }),
      )
    ).writes.length,
    0,
  );
  assert.equal(
    (await worker('/_next/static/app.js', 'cors', new Response('static'))).writes.length,
    1,
  );
});
