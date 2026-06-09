// ── GFinHub Service Worker ────────────────────────────────────────────────────
// Version: bump this string every time you deploy to force an update on users
const CACHE_VERSION = 'gfinhub-v1';

// What to cache for offline use (the app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── INSTALL: cache app shell on first install ─────────────────────────────────
self.addEventListener('install', event => {
  // Skip waiting forces the new SW to activate immediately
  // instead of waiting for all tabs to close
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
});

// ── ACTIVATE: clean up old caches from previous versions ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// ── FETCH: network-first strategy ────────────────────────────────────────────
// For API calls: always go to network (live market data must be fresh)
// For app shell: network first, fall back to cache if offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network-only for API calls — never serve stale financial data
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.openai.com') {
    return; // Let the browser handle it normally (no SW interception)
  }

  // For fonts and external resources — cache first
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // For app shell (HTML, manifest) — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the fresh response
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache (offline mode)
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Ultimate fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── MESSAGE HANDLER: respond to commands from the app ─────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    // App tapped "Update Now" — activate the new SW immediately
    self.skipWaiting();
  }
});
