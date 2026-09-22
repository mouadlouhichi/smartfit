import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonObject } from '../src/lib/request-body';
import { FeatureError } from '@smartfit/core';
const matches = (status: number) => (error: unknown) =>
  error instanceof FeatureError && error.status === status;
const request = (body: string) => new Request('http://smartfit.test', { method: 'POST', body });
test('bounded reader accepts JSON objects and rejects malformed or non-object JSON', async () => {
  assert.deepEqual(await readJsonObject(request('{"role":"staff"}')), { role: 'staff' });
  for (const body of ['', '{', 'null', '[]', '"text"'])
    await assert.rejects(readJsonObject(request(body)), matches(400));
});
test('streaming reader stops and cancels oversized bodies without trusting Content-Length', async () => {
  let pulls = 0,
    cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(20000).fill(32));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const req = new Request('http://smartfit.test', {
    method: 'POST',
    headers: { 'content-length': '1' },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(readJsonObject(req), matches(413));
  assert.equal(cancelled, true);
  assert.equal(pulls, 3);
});
test('declared oversized bodies are refused before consuming the stream', async () => {
  let read = false,
    cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull() {
        read = true;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const req = new Request('http://smartfit.test', {
    method: 'POST',
    headers: { 'content-length': '40001' },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(readJsonObject(req), matches(413));
  assert.equal(read, false);
  assert.equal(cancelled, true);
});
test('UTF-8 may cross chunks, and the limit counts bytes rather than JS characters', async () => {
  const bytes = new TextEncoder().encode('{"name":"مستخدم"}');
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i === bytes.length) controller.close();
      else controller.enqueue(bytes.slice(i, (i += 1)));
    },
  });
  const req = new Request('http://smartfit.test', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit);
  assert.deepEqual(await readJsonObject(req, bytes.length), { name: 'مستخدم' });
  await assert.rejects(
    readJsonObject(request('{"name":"مستخدم"}'), bytes.length - 1),
    matches(413),
  );
});
test('invalid UTF-8 is rejected instead of silently replacing corrupted input', async () => {
  const req = new Request('http://smartfit.test', {
    method: 'POST',
    body: new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125]),
  });
  await assert.rejects(readJsonObject(req), matches(400));
});
