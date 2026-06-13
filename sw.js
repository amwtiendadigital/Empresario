const CACHE = 'amwdigital-v5';

// External CDN resources — cache-first (versioned, never change)
const CDN_CACHE = 'amwdigital-cdn-v1';
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Our own app files — pre-cache on install
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: pre-cache everything ──────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then(c => c.addAll(APP_ASSETS)).catch(() => {}),
      caches.open(CDN_CACHE).then(c => c.addAll(CDN_URLS)).catch(() => {})
    ])
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── ACTIVATE: delete old caches ────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // CDN resources → cache-first (versioned, stable)
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CDN_CACHE).then(c => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Amway product images → cache-first with background refresh
  if (url.hostname.includes('amway.com')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => {
            if (res && res.status === 200) c.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Own app files → network-first, fall back to cache
  // This ensures users always get the latest version when online
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached =>
          cached || caches.match('./index.html')
        )
      )
  );
});
