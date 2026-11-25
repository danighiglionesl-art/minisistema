const CACHE_NAME = 'minisistema-erp-v325.14';
const SHELL_CACHE_NAME = 'minisistema-shell-v325.14';
const ACTIVE_CACHES = [CACHE_NAME, SHELL_CACHE_NAME];
const ASSETS_TO_CACHE = [];

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
          .filter((key) => !ACTIVE_CACHES.includes(key))
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

function fetchWithTimeout(request, timeoutMs, extraInit) {
  return new Promise((resolve, reject) => {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (controller) {
        try { controller.abort(); } catch (_e) {}
      }
      reject(new Error('SW_FETCH_TIMEOUT'));
    }, timeoutMs);

    const init = Object.assign({}, extraInit || {});
    if (controller) init.signal = controller.signal;

    fetch(request, init)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/api/')) return;

  const url = new URL(request.url);
  const isHtmlNav =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  // 1. Navegación HTML del ERP (App Shell por ruta exacta en el mismo origen -> 100% aislado por tenant)
  // Estrategia: Network-First con timeout de 5s -> fallback al HTML guardado en caché local
  if (isHtmlNav) {
    const shellKey = new Request(url.origin + url.pathname, { method: 'GET' });
    event.respondWith(
      fetchWithTimeout(request, 5000, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => {
              cache.put(shellKey, clone).catch(() => {});
            });
            return networkResponse;
          }
          // Si el servidor devolvió 5xx, intentar servir el App Shell offline
          if (networkResponse && networkResponse.status >= 500) {
            return caches.open(SHELL_CACHE_NAME).then((cache) =>
              cache.match(shellKey).then((cached) => cached || networkResponse)
            );
          }
          return networkResponse;
        })
        .catch(() =>
          caches.open(SHELL_CACHE_NAME).then((cache) =>
            cache
              .match(shellKey)
              .then((cached) => cached || cache.match(new Request(url.origin + '/sistema')))
          )
        )
    );
    return;
  }

  // 2. Recursos estáticos del ERP (JS, CSS, imágenes, fuentes): Network-First con timeout 6s -> fallback caché
  event.respondWith(
    fetchWithTimeout(request, 6000, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
          return networkResponse;
        }
        if (networkResponse && networkResponse.status >= 500) {
          return caches
            .match(request)
            .then((hit) => hit || caches.match(request, { ignoreSearch: true }))
            .then((hit) => hit || networkResponse);
        }
        return networkResponse;
      })
      .catch(() =>
        caches
          .match(request)
          .then((hit) => hit || caches.match(request, { ignoreSearch: true }))
      )
  );
});
