/* DiaryBuddy Service Worker — hand-rolled, no runtime deps.
 *
 * Strategy:
 *   - App shell (icons, manifest, offline fallback): cache-first
 *   - Navigation requests: network-first → cached shell → offline page
 *   - /api/** (Supabase, Gemini, Notion): network-only (never cache)
 *   - Auth routes (/login, /auth/**): network-only (don't cache auth state)
 *
 * Bump CACHE_VERSION to invalidate all old caches on next install.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `db-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `db-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}
function isAuthRequest(url) {
  return (
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/login' ||
    url.pathname.startsWith('/login/')
  );
}
function isNextInternal(url) {
  // Let Next.js manage its own _next/* caching; don't interfere.
  return url.pathname.startsWith('/_next/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url) || isAuthRequest(url) || isNextInternal(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match('/') ||
              new Response(
                '<!doctype html><meta charset="utf-8"><title>DiaryBuddy · 离线</title><style>body{font-family:system-ui;background:#FDFBF7;color:#2B2A27;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}</style><h1 style="font-weight:500">暂时离线</h1><p>网络恢复后刷新即可继续写作。</p>',
                { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
              ),
          ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
