/*
 * SmartFit service worker.
 *
 * Strategy:
 *  - navigations  : stale-while-revalidate — the cached shell paints
 *                   immediately (that is what makes a home-screen launch
 *                   feel instant), the network refreshes it in the
 *                   background, and the offline page is the last resort.
 *  - static build : cache-first (immutable, content-hashed by Next).
 *  - everything   : stale-while-revalidate for same-origin GETs.
 *
 * The app's *data* is already offline-capable (localStorage in local mode,
 * Firestore's IndexedDB cache in cloud mode); this only covers the shell.
 */
const VERSION = 'smartfit-v10'; // bigger flame mark + SWR navigations; evict old shells/icons
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
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Firebase/API traffic

  // App shell navigations: stale-while-revalidate. A home-screen tap paints
  // the cached shell on the first frame instead of waiting on the network;
  // the fresh response lands in the cache for the next launch. waitUntil
  // keeps the worker alive long enough to finish that background refresh.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            cache.put(request, copy).catch(() => undefined);
            return response;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network.then(() => undefined));
          return cached;
        }
        return (await network) ?? (await caches.match(OFFLINE_URL));
      })(),
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
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy)).catch(() => undefined);
            return response;
          }),
      ),
    );
  }
});
