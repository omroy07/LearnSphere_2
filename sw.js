/*
 * LearnSphere PWA Service Worker
 * Offline-first app shell caching + runtime caching for same-origin assets.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `learnsphere-static-${CACHE_VERSION}`;

// App shell URLs to cache at install time.
// Keep this list conservative; runtime caching covers the rest.
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/home.html",
  "/courses.html",
  "/explore.html",
  "/resources.html",
  "/community.html",
  "/learner.html",
  "/parents.html",
  "/teachers.html",
  "/my_progress.html",
  "/404.html",

  // CSS
  "/styles.css",
  "/variables.css",
  "/home.css",

  // JS
  "/script.js",
  "/navbar.js",
  "/home.js",
  "/theme.js",
  "/progress.js",
  "/quizProgress.js",

  // Images
  "/student.png",

  // Fontawesome is loaded from CDN; we do not cache it here.
];

// Query parameter helpers
function isSameOrigin(url) {
  return url && url.origin === self.location.origin;
}

function requestUrl(event) {
  try {
    return new URL(event.request.url);
  } catch {
    return null;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL_URLS);
      // Activate SW immediately
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = requestUrl(event);

  // Only handle GET requests
  if (req.method !== "GET") return;

  // Navigation: offline fallback to cached app shell.
  if (req.mode === "navigate" || (req.destination === "document")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(req);
          // Optionally cache navigation responses (app shell only)
          if (req.url.includes(".html")) {
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          const cachedIndex = await cache.match("/index.html");
          const cached404 = await cache.match("/404.html");
          return cachedIndex || cached404;
        }
      })()
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate
  if (url && isSameOrigin(url)) {
    const isAsset =
      req.destination === "script" ||
      req.destination === "style" ||
      req.destination === "image" ||
      req.destination === "font" ||
      req.destination === "worker" ||
      req.destination === "document" ||
      req.destination === "fetch";

    // Also cover common file types even when destination is not set
    const pathname = url.pathname;
    const fileLike =
      pathname.endsWith(".js") ||
      pathname.endsWith(".css") ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg") ||
      pathname.endsWith(".gif") ||
      pathname.endsWith(".svg") ||
      pathname.endsWith(".webp") ||
      pathname.endsWith(".woff") ||
      pathname.endsWith(".woff2") ||
      pathname.endsWith(".ttf") ||
      pathname.endsWith(".eot");

    if (isAsset || fileLike) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          const fetchPromise = fetch(req)
            .then((fresh) => {
              cache.put(req, fresh.clone()).catch(() => {});
              return fresh;
            })
            .catch(() => null);

          if (cached) {
            // Return cached immediately, update in background.
            // Note: If fetch fails, cached still serves offline.
            return cached;
          }

          const fresh = await fetchPromise;
          return fresh || cached || new Response("", { status: 404, statusText: "Offline" });
        })()
      );
    }
  }
});

// Provide install prompt behavior is not handled here (client-side).

