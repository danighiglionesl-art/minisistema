const CACHE_NAME = 'minisistema-erp-v323.1';
const ASSETS_TO_CACHE = [
  '/sistema/assets/js/brand.js?v=323.1',
  '/sistema/assets/css/styles.css?v=323.1',
  '/sistema/assets/css/brand-minisistema.css?v=323.1',
  '/sistema/assets/js/zxing.min.js?v=323.1',
  '/sistema/assets/js/app.js?v=323.1',
  '/sistema/assets/js/superadmin-panel.js?v=323.1',
  '/sistema/assets/js/cv-module.js?v=323.1',
  '/sistema/assets/js/asistencia-module.js?v=323.1',
  '/sistema/assets/js/personal-module.js?v=323.1',
  '/sistema/assets/js/turnos-module.js?v=323.1',
  '/sistema/assets/js/mi-contador-module.js?v=323.1',
  '/sistema/assets/img/minisistema/logo-1x1.png',
  '/sistema/assets/img/minisistema/logo-horizontal.png',
  '/sistema/assets/img/minisistema/logo-symbol.png',
  '/sistema/assets/img/minisistema/icon-512.png',
  '/sistema/assets/img/minisistema/icon-192.png',
  '/sistema/assets/img/minisistema/apple-touch-icon.png',
  '/sistema/assets/img/minisistema/favicon-64.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
