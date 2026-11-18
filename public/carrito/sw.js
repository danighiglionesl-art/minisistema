const APP_BUILD_VERSION = 'v48-20261118153738';

const IS_PASEO_SW =
  self.location.hostname.includes('paseoalberdi') ||
  self.location.hostname.includes('vercel.app') ||
  self.location.pathname.includes('/_paseoalberdi/');

const CACHE_NAME = (IS_PASEO_SW ? 'paseoalberdi-carrito-' : 'casanueva-app-') + APP_BUILD_VERSION;

const PRECACHE_URLS = IS_PASEO_SW
  ? [
      '/sistema/assets/img/paseo-alberdi/icon-192.png?v=1',
      '/sistema/assets/img/paseo-alberdi/icon-512.png?v=1',
      '/sistema/assets/img/paseo-alberdi/apple-touch-icon.png?v=1'
    ]
  : [
      '/carrito/assets/img/icon-192.png?v=25',
      '/carrito/assets/img/icon-512.png?v=25',
      '/carrito/assets/img/apple-touch-icon.png?v=25'
    ];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            try {
              client.postMessage({ type: 'CARRITO_SW_ACTIVATED', version: APP_BUILD_VERSION });
            } catch (_e) {}
          });
        })
      )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/version.json')) return;

  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});
