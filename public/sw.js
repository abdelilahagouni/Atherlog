// Service Worker (PWA offline support) - v4.
//
// Why v4: v3 served the app's code "cache first", so a browser that had it kept showing an OLD version of the app
// after updates (new features missing in that browser). Browsers re-check this file on every visit, so this version
// replaces v3 everywhere it is installed:
//   - On this computer / the local network (dev server): it deletes all its caches, unregisters itself and reloads
//     the open pages, so the browser always gets the current code from the dev server.
//   - On a deployed site: NETWORK FIRST for everything (the server always wins); the cache is only used when offline.
//     API responses are never cached (they contain account data).
const VERSION = 'v4';
const CACHE_NAME = `aetherlog-${VERSION}`;

const host = self.location.hostname;
const IS_DEV_HOST =
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]' ||
  /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local');

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove every old cache (v3 and earlier) - and on dev hosts, all caches.
    const names = await caches.keys();
    await Promise.all(names.filter((n) => IS_DEV_HOST || n !== CACHE_NAME).map((n) => caches.delete(n)));
    if (IS_DEV_HOST) {
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: 'window' });
      pages.forEach((page) => page.navigate(page.url));   // reload once, now without any service worker
      return;
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (IS_DEV_HOST) return;                         // dev: never intercept, always the dev server
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;    // API: never cached

  // Network first; keep a copy only as an offline fallback.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch (e) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('/')) || Response.error();
      return Response.error();
    }
  })());
});

// Push notification support
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from AetherLog',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { dateOfArrival: Date.now(), primaryKey: 1 }
  };
  event.waitUntil(self.registration.showNotification('AetherLog', options));
});
