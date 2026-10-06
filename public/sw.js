// Service Worker for Number Shot Pro PWA
const CACHE_NAME = 'numbershot-pro-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/site.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass API and live stream requests directly to network
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Periodic background sync support for PWABuilder store readiness
self.addEventListener('periodicsync', (event) => {
  // background periodic sync logic
});

self.addEventListener('sync', (event) => {
  // background sync logic
});

self.addEventListener('push', (event) => {
  // push notification support
});
