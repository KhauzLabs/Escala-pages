
const CACHE = 'escala-pages-update-20261102-1800';
const VERSION = '20261102-1800';
const CORE = './index.html';
const OPTIONAL = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.add(CORE);
    await Promise.allSettled(
      OPTIONAL.map(path => cache.add(path))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(name =>
        (name.startsWith('minha-escala-app-') ||
         name.startsWith('escala-pages-')) &&
        name !== CACHE
      ).map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

const INJECT = `<script data-escala-update>
(function(){
  if (!('serviceWorker' in navigator)) return;

  const installedVersion = '20261102-1800';
  let dismissed = false;
  let showing = false;

  function showUpdate(){
    if (dismissed || showing) return;
    showing = true;

    const backdrop = document.createElement('div');
    backdrop.id = 'escala-update-dialog';
    backdrop.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;' +
      'background:#0009;display:grid;place-items:center;padding:20px';

    backdrop.innerHTML =
      '<div role="dialog" aria-modal="true" ' +
      'aria-labelledby="escala-update-title" ' +
      'style="width:min(100%,380px);background:#18263e;' +
      'color:#f6f7fb;border:1px solid #536581;border-radius:20px;' +
      'padding:24px;box-shadow:0 20px 60px #0009;' +
      'font-family:system-ui,sans-serif">' +
      '<h2 id="escala-update-title" style="margin:0 0 12px;font-size:21px">' +
      'Nova atualização disponível</h2>' +
      '<p style="line-height:1.5;font-size:14px;margin:0 0 20px">' +
      'Existe uma nova versão da Escala. Os teus dados guardados serão mantidos.</p>' +
      '<button id="escala-update-now" style="width:100%;padding:14px;' +
      'border:0;border-radius:12px;background:#f2cb70;color:#142034;' +
      'font-weight:700">Atualizar agora</button>' +
      '<button id="escala-update-later" style="width:100%;padding:12px;' +
      'border:0;background:transparent;color:#e1e8f5">Mais tarde</button>' +
      '</div>';

    document.body.appendChild(backdrop);

    backdrop.querySelector('#escala-update-later').onclick = () => {
      dismissed = true;
      backdrop.remove();
      showing = false;
    };

    backdrop.querySelector('#escala-update-now').onclick = async () => {
      const button = backdrop.querySelector('#escala-update-now');
      button.disabled = true;
      button.textContent = 'A atualizar…';

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch(e) {}

      location.reload();
    };
  }

  async function check(){
    if (dismissed || !navigator.onLine) return;

    try {
      const url = new URL('./sw.js', location.href);
      url.searchParams.set('check', Date.now());

      const res = await fetch(url, {cache:'no-store'});
      if (!res.ok) return;

      const code = await res.text();
      const match = code.match(/const VERSION = '([^']+)'/);

      if (match && match[1] !== installedVersion) {
        showUpdate();
      }
    } catch(e) {}
  }

  window.addEventListener('load', () => {
    setTimeout(check, 1500);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });

  window.addEventListener('online', check);

  setInterval(() => {
    if (!document.hidden) check();
  }, 15 * 60 * 1000);
})();
<\/script>`;

async function decorate(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'text/html; charset=utf-8');

  const html = await response.text();

  return new Response(
    html.replace(/<\/body>/i, INJECT + '\n</body>'),
    {
      status: response.status,
      statusText: response.statusText,
      headers
    }
  );
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      let response;

      try {
        response = await fetch(req, {cache:'no-store'});
        if (!response.ok) throw new Error('network');

        const cache = await caches.open(CACHE);
        await cache.put(CORE, response.clone());
      } catch(e) {
        response = await caches.match(CORE);
      }

      if (!response) return Response.error();
      return decorate(response);
    })());
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
