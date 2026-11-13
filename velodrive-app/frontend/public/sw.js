const CACHE_NAME = 'velodrive-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.jpg',
  '/paypal-logo.png',
];
const offlineResponse = () => new Response('VeloDrive is unavailable while offline.', {
  status: 503,
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

// Install event - cache static assets (NOT index.html - always fetch fresh)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, API calls, and non-http(s) schemes
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML documents (always serve latest index.html)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request) || await caches.match('/index.html');
          return cachedPage || offlineResponse();
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((response) => {
            if (response.ok && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => offlineResponse());
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
