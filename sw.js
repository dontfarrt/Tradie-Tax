// ════════════════════════════════════════════════════
//  Tradie Tax Tracker — Service Worker
//  Bump CACHE_VERSION whenever you update index.html
// ════════════════════════════════════════════════════
const CACHE_VERSION = 'v4';
const CACHE_NAME = `tradie-tax-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Activate this new SW immediately instead of waiting
  self.skipWaiting();
});

// Activate: nuke any old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - For navigation requests (the HTML page): network-first, fall back to cache.
//     This means a fresh deploy is picked up immediately when online.
//   - For other assets (icons, manifest, fonts): cache-first for speed.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Cache the fresh response for offline fallback
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Allow the page to tell us "activate the new SW now"
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
