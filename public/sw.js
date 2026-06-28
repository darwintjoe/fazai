// FAZAI Service Worker v2
const CACHE_NAME = 'fazai-v2';
const IMMUTABLE_ASSETS = [
  '/FAZAI.jpg',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
];

// Install — cache only truly immutable assets (images, icons)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(IMMUTABLE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Web Share Target POST: intercept shared files, store in cache, redirect
// - API routes: network first, cache fallback
// - _next/static/*: stale-while-revalidate (show cached, update in background)
// - Images/icons: cache first
// - Everything else (HTML, etc): network first, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // ── Web Share Target POST ──
  // Must come before the non-GET guard
  if (request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('files');
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';
          const sharedUrl = formData.get('url') || '';

          const cache = await caches.open('shared-files');

          // Store shared files (images)
          for (let i = 0; i < files.length; i++) {
            const response = new Response(files[i]);
            await cache.put(`/shared-image-${i}`, response);
          }

          // Store metadata as a JSON response
          await cache.put('/shared-meta', new Response(JSON.stringify({ title, text, url: sharedUrl })));

          // Store count so the page knows how many files to read
          await cache.put('/shared-count', new Response(String(files.length)));
        } catch (err) {
          // Even if reading formData fails, redirect to the page
          console.error('Share target error:', err);
        }

        // 303 redirect converts POST to GET
        // Use the same pathname the POST came to (respects basePath)
        return Response.redirect(url.pathname.replace(/\/share-target\/?$/, '/share-target/') || '/share-target/', 303);
      })()
    );
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API routes — network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Next.js static chunks — stale-while-revalidate
  // These have content hashes in filenames so they're safe to cache,
  // but we still update in background to pick up new chunks
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Return cached immediately if available, but also fetch update in background
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Images/icons — cache first (these rarely change)
  if (/\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages & everything else — network first
  // This ensures users always get the latest app code
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
