import { FeatureError, objectValue } from '@smartfit/core';

/** Bound memory while reading, not after req.text() has buffered an arbitrary payload. */
export async function readJsonObject(
  req: Request,
  maxBytes = 40000,
): Promise<Record<string, unknown>> {
  const declared = req.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared))))
    throw new FeatureError('Invalid content length.');
  if (declared !== null && Number(declared) > maxBytes) {
    void req.body?.cancel().catch(() => undefined);
    throw new FeatureError('Request is too large.', 413);
  }
  if (!req.body) throw new FeatureError('Expected JSON.');
  const reader = req.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0,
    text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new FeatureError('Request is too large.', 413);
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return objectValue(JSON.parse(text));
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof FeatureError) throw error;
    throw new FeatureError('Expected valid UTF-8 JSON.');
  } finally {
    reader.releaseLock();
  }
}
