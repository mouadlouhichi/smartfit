import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnostic, collectorUrl, reportDiagnostic } from '../src/lib/report.ts';

/**
 * The diagnostics module must be safe in two directions: useful when a
 * deployment points it at a self-hosted collector, and completely silent
 * when it doesn't — the privacy page promises "no analytics SDKs", and the
 * default build has to keep that promise. It must also never let a report
 * become the next crash.
 */

test('diagnostics are disabled by default', () => {
  delete process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
  assert.equal(collectorUrl(), '');
  // A no-op call must not throw in a browser-less environment either.
  assert.doesNotThrow(() => reportDiagnostic(buildDiagnostic('test', new Error('x'))));
});

test('the collector URL is read from the environment, trimmed', () => {
  process.env.NEXT_PUBLIC_ERROR_ENDPOINT = '  https://collector.example/ingest  ';
  assert.equal(collectorUrl(), 'https://collector.example/ingest');
  delete process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
});

test('an Error becomes scope + message + stack', () => {
  const err = new Error('chart exploded');
  const event = buildDiagnostic('route', err, { digest: 'abc123' });
  assert.equal(event.scope, 'route');
  assert.equal(event.message, 'chart exploded');
  assert.ok(event.stack?.includes('Error: chart exploded'));
  assert.deepEqual(event.extra, { digest: 'abc123' });
  assert.ok(event.ts > 0);
});

test('oversized messages and stacks are clipped, not sent whole', () => {
  const err = new Error('x'.repeat(5000));
  err.stack = 'y'.repeat(50000);
  const event = buildDiagnostic('window.error', err);
  assert.ok(event.message.length <= 301); // 300 + ellipsis
  assert.ok((event.stack ?? '').length <= 4001);
});

test('anything thrown is reportable — strings, objects, null, undefined', () => {
  assert.equal(buildDiagnostic('unhandledrejection', 'plain string').message, 'plain string');
  assert.equal(buildDiagnostic('unhandledrejection', { code: 42 }).message, '{"code":42}');
  assert.ok(buildDiagnostic('unhandledrejection', null).message.length > 0);
  assert.ok(buildDiagnostic('unhandledrejection', undefined).message.length > 0);
  // Circular structures must not turn reporting into a new exception.
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.doesNotThrow(() => buildDiagnostic('unhandledrejection', circular));
});

test('no path is recorded outside a browser (and never a query string)', () => {
  // Node has no `window`, so `path` must simply be absent — the pathname-only
  // rule exists because query strings can carry personal data.
  const event = buildDiagnostic('route', new Error('x'));
  assert.equal(event.path, undefined);
});
