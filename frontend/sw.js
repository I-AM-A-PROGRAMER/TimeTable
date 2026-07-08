const CACHE_NAME = "kiit-schedule-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

// Install Event - cache static assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network-first for API, stale-while-revalidate for static assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 1. Handle API requests with Network-First strategy, falling back to cache
  if (url.pathname.includes("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // If valid response, clone and cache it
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log("[Service Worker] Fetch failed, serving API from cache fallback:", url.pathname);
          return caches.match(e.request);
        })
    );
  } else {
    // 2. Handle static assets & external Google fonts with Stale-While-Revalidate/Cache-First strategy
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch from network in the background to update the cache
          fetch(e.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(e.request, networkResponse);
                });
              }
            })
            .catch(() => {
              // Ignore network failures for background updates
            });
          return cachedResponse;
        }

        // Cache miss -> Fetch from network
        return fetch(e.request).then((networkResponse) => {
          // Cache fonts or local static assets on-the-fly
          if (
            networkResponse.status === 200 &&
            (url.origin === self.location.origin ||
             url.hostname.includes("fonts.googleapis.com") ||
             url.hostname.includes("fonts.gstatic.com"))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
