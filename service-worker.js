const CACHE_NAME = 'softservice-v1';
const ASSETS_TO_CACHE = [
  '/dashboard.html',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache dashboard + offline pages
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for dashboard + offline fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Use cache first
        if (cachedResponse) {
          // Update in background
          fetch(event.request).then(networkResponse => {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, networkResponse.clone())
            );
          }).catch(() => {});
          return cachedResponse;
        }

        // Else try network
        return fetch(event.request)
          .then(networkResponse => {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, networkResponse.clone())
            );
            return networkResponse;
          })
          .catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});