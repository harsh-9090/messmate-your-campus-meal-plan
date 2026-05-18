const CACHE_NAME = 'messmate-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple network-first strategy for SSR compatibility
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
