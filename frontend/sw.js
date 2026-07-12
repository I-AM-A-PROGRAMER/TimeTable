const CACHE_NAME = "kiit-schedule-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
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

// Fetch Event
self.addEventListener("fetch", (e) => {
  // Only handle GET requests and http/https protocols (prevents crashing on chrome-extensions etc.)
  if (e.request.method !== "GET" || !e.request.url.startsWith("http")) {
    return;
  }

  const url = new URL(e.request.url);

  // 1. Handle API requests with Network-First strategy
  if (url.pathname.includes("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log("[Service Worker] API network fetch failed, serving from cache:", url.pathname);
          return caches.match(e.request);
        })
    );
  } else {
    // 2. Handle static assets & Google Fonts with Stale-While-Revalidate / Cache-First strategy
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch from network in the background to update the cache.
          // We use e.request.url (string) instead of e.request to avoid "Cannot fetch navigate request" errors in Chrome/Safari.
          e.waitUntil(
            fetch(e.request.url)
              .then((networkResponse) => {
                if (networkResponse.status === 200) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request.url, networkResponse);
                  });
                }
              })
              .catch(() => {
                // Ignore network errors during background updates
              })
          );
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
        }).catch((err) => {
          console.error("[Service Worker] Fetch failed for:", e.request.url, err);
          throw err;
        });
      })
    );
  }
});
