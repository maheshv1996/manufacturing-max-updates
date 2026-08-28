const CACHE_NAME = 'mfgmax-cache-v4';
const SHELL_CACHE = 'mfgmax-shell-v4';

const SHELL_ASSETS = [
  '/',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== SHELL_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs; never intercept writes (they go through
  // the offline sync queue instead).
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // NAVIGATION FIRST: always network-first so a rebuild is picked up the
  // moment the server serves new HTML (never serve a stale cached shell on
  // top of updated chunks). The real gateway (path '/') refreshes the shell
  // cache; every other navigation only falls back to the cached shell when
  // the network is unreachable. IMPORTANT: only the real gateway (path '/')
  // may refresh the shell — caching every navigation under '/' made the
  // fallback serve the LAST-VISITED page (e.g. the operator terminal) for
  // any offline navigation.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok && url.pathname === '/') {
            const clone = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/', clone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match('/').then((shell) => shell || caches.match(request))
        )
    );
    return;
  }

  // Static assets (hashed build output): cache-first is safe — new builds
  // emit new hashed filenames, and a cache-name bump purges stale entries.
  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // API / data: network-first with cache fallback (read-only GETs only).
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
