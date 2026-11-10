/* Escala v1.5.59 — cache offline controlada; pedidos JSON nunca recebem HTML. */
const CACHE = 'escala-pages-v1559-cardinal-trailing-slash';
const CORE = './index.html';
const OPTIONAL = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Não bloqueia a instalação se o alojamento estiver temporariamente indisponível.
    try {
      const response = await fetch(CORE, { cache: 'reload' });
      if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
        await cache.put(CORE, response);
      }
    } catch (_) {}
    await Promise.allSettled(OPTIONAL.map(async path => {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k =>
      (k.startsWith('escala-pages-') || k.startsWith('minha-escala-app-')) && k !== CACHE
    ).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // JSON e scripts devem ser servidos pelo servidor; nunca substituir respostas 404 por index.html.
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req, { cache: 'no-store' });
        if (!response.ok) return response; // Um 404 real não vira calendário.
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html') && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
          const cache = await caches.open(CACHE);
          await cache.put(CORE, response.clone());
        }
        return response;
      } catch (_) {
        // Só usar fallback offline para a página principal.
        if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
          return (await caches.match(CORE)) || Response.error();
        }
        return Response.error();
      }
    })());
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
