/* Only public static assets are cached. Private navigations and APIs stay network-only.
 * Firestore/local account storage has its own explicit offline policy.
 */
const VERSION = 'smartfit-v11'; // evict all previous cached private HTML
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

// Query-stringed to match what the document actually requests (icon URLs are
// cache-busted by ?v=; a bare path here would precache bytes nobody asks for).
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest?v=9',
  '/icon.svg?v=9',
  '/icons/icon-192.png?v=9',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/')
  );
}
function cacheable(response) {
  return (
    response.ok &&
    !response.redirected &&
    response.type !== 'opaque' &&
    !/private|no-store/i.test(response.headers.get('Cache-Control') || '')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Firebase/API traffic

  // API and React server-component requests must never be cached as static assets.
  if (url.pathname.startsWith('/api/') || request.headers.has('RSC')) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(OFFLINE_URL)) ??
          new Response('You are offline. Reconnect to continue.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          }),
      ),
    );
    return;
  }

  // Immutable build output.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (cacheable(response)) {
              const copy = response.clone();
              event.waitUntil(
                caches
                  .open(ASSET_CACHE)
                  .then((c) => c.put(request, copy))
                  .catch(() => undefined),
              );
            }
            return response;
          }),
      ),
    );
  }
});
