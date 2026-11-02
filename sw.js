/* Escala — correção de atualização PWA, mantendo os dados locais intactos. */
const CACHE = 'escala-pages-v1522-20261102';
const CORE = './index.html';
const OPTIONAL = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // O HTML é obrigatório; ícones podem faltar sem bloquear a atualização.
    await cache.add(CORE);
    await Promise.allSettled(OPTIONAL.map((file) => cache.add(file)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('minha-escala-app-') && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, {cache: 'no-store'});
        if (!response.ok) throw new Error('Resposta de rede inválida');
        const cache = await caches.open(CACHE);
        await cache.put(CORE, response.clone());
        return response;
      } catch (_err) {
        return (await caches.match(CORE)) || Response.error();
      }
    })());
    return;
  }

  // Preferir os recursos atuais; disponibilizar os armazenados se estiver offline.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
