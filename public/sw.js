const SHELL_CACHE = 'radcore-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-radcore.png',
  '/logo-radcore-touch.svg',
];
const TRUSTED_STATIC_ORIGINS = new Set([
  self.location.origin,
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.tailwindcss.com',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('radcore-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  TRUSTED_STATIC_ORIGINS.has(url.origin)
  && (
    url.pathname.startsWith('/assets/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === '/logo-radcore.png'
    || url.pathname === '/logo-radcore-touch.svg'
    || url.origin !== self.location.origin
  );

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!TRUSTED_STATIC_ORIGINS.has(url.origin) || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  if (!isStaticAsset(url)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok || response.type === 'opaque') {
        const copy = response.clone();
        void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
