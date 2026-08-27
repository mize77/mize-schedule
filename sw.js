// ────────────────────────────────────────────────────────────────
//  MIZE Schedule — service worker
//
//  Bump CACHE_VERSION on EVERY deploy of index.html / messages.js /
//  the icons. The version string is what forces phones off the old
//  build; without a bump a stale worker can pin you to old code.
//
//  Strategy:
//    same-origin shell  → cache-first, refreshed in the background
//    gist schedule JSON → network-first, cache as offline fallback
//    api.github.com     → never touched (carries the auth header)
// ────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'mize-v2';
const SHELL_CACHE   = CACHE_VERSION + '-shell';
const DATA_CACHE    = CACHE_VERSION + '-data';

const SHELL = [
  './',
  './index.html',
  './messages.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Cache each entry individually — one 404 must not fail the whole install.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(err =>
        console.warn('[sw] could not cache', url, err && err.message))
    ));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Never intercept the GitHub API — those requests carry the token.
  if (url.hostname === 'api.github.com') return;

  // Schedule JSON: network-first, fall back to the last good copy offline.
  if (url.hostname === 'gist.githubusercontent.com') {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        // Cache keys include the ?t= cache-buster, so match loosely.
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  // Same-origin shell: cache-first, revalidate in the background.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await network) || new Response('Offline', { status: 503 });
    })());
  }
});
