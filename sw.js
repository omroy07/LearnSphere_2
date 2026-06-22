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
  "/review.html",
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
  "/review.js",
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

  // Navigation: offline fallback to cached index / 404
  if (req.mode === "navigate" || (req.destination === "document")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(req);
          if (req.url.includes(".html")) {
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          const cachedIndex = await cache.match("/index.html") || await cache.match("/home.html");
          const cached404 = await cache.match("/404.html");
          return cachedIndex || cached404 || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Same-origin static assets: Cache-First strategy
  if (url && isSameOrigin(url)) {
    const isAsset =
      req.destination === "script" ||
      req.destination === "style" ||
      req.destination === "image" ||
      req.destination === "font" ||
      req.destination === "worker" ||
      req.destination === "document" ||
      req.destination === "fetch";

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
      pathname.endsWith(".eot") ||
      pathname.endsWith(".html");

    if (isAsset || fileLike) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          if (cached) {
            return cached; // Return cached immediately
          }
          try {
            const fresh = await fetch(req);
            if (fresh && fresh.status === 200) {
              cache.put(req, fresh.clone()).catch(() => {});
            }
            return fresh;
          } catch (err) {
            return new Response("Offline Resource Not Cached", { status: 503 });
          }
        })()
      );
      return;
    }
  }

  // Cross-origin or dynamic endpoints: Network-First strategy
  event.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch (err) {
        return new Response("Offline API Service Unavailable", { status: 503 });
      }
    })()
  );
});

// Listener for message events to support on-demand preloading of resources
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "preload") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        
        const urlsToPreload = [
          // Quizzes HTML
          "/quiz/motionquiz.html",
          "/quiz/nlmquiz.html",
          "/quiz/projectilequiz.html",
          "/quiz/rayquiz.html",
          "/mathsquiz/calculusquiz.html",
          "/mathsquiz/geometryquiz.html",
          "/mathsquiz/probabilityquiz.html",
          "/mathsquiz/vectorquiz.html",
          "/chemistryquiz/atomic_structurequiz.html",
          "/chemistryquiz/chemical_bondingquiz.html",
          "/chemistryquiz/equilibriumquiz.html",
          "/chemistryquiz/thermoquiz.html",
          
          // Quizzes JS
          "/quiz/motionquiz.js",
          "/quiz/nlmquiz.js",
          "/quiz/projectilequiz.js",
          "/quiz/rayquiz.js",
          "/quiz/adaptiveQuiz.js",
          "/mathsquiz/calculusquiz.js",
          "/mathsquiz/geometryquiz.js",
          "/mathsquiz/probabilityquiz.js",
          "/mathsquiz/vectorquiz.js",
          "/chemistryquiz/atomic_structurequiz.js",
          "/chemistryquiz/chemical_bondingquiz.js",
          "/chemistryquiz/equilibriumquiz.js",
          "/chemistryquiz/thermoquiz.js",
          "/quizAssignmentHelper.js",

          // Quizzes CSS
          "/quiz/motionquiz.css",
          "/quiz/nlmquiz.css",
          "/quiz/projectilequiz.css",
          "/quiz/rayquiz.css",
          "/mathsquiz/calculusquiz.css",
          "/mathsquiz/geometryquiz.css",
          "/mathsquiz/probabilityquiz.css",
          "/mathsquiz/vectorquiz.css",
          "/chemistryquiz/atomic_structurequiz.css",
          "/chemistryquiz/chemical_bondingquiz.css",
          "/chemistryquiz/equilibriumquiz.css",
          "/chemistryquiz/thermoquiz.css",

          // Subject Pages
          "/sub/maths.html",
          "/sub/physics.html",
          "/sub/chemistry.html",
          "/sub/biology.html"
        ];

        try {
          await cache.addAll(urlsToPreload);
          
          // Notify clients of success
          const clientsList = await self.clients.matchAll();
          clientsList.forEach((client) => {
            client.postMessage({ action: "preload-complete", success: true });
          });
        } catch (err) {
          console.error("LearnSphere: SW offline preloading failed:", err);
          const clientsList = await self.clients.matchAll();
          clientsList.forEach((client) => {
            client.postMessage({ action: "preload-complete", success: false, error: err.message });
          });
        }
      })()
    );
  }
});

