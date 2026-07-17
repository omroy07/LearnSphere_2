/*
 * LearnSphere PWA Service Worker
 * Offline-first app shell caching + runtime caching for same-origin assets.
 */

// Cache versioning / busting
// Prefer deriving from manifest version so caches update after deploy.
// Fallback to timestamp to avoid serving an old cache if manifest is missing/unchanged.
// Important: Service workers cannot synchronously read manifest.json.
// Keep a deterministic, deploy-time value so old caches are invalidated.
// Update this when releasing a new build.
const CACHE_VERSION = "v5";
const CACHE_NAME = `learnsphere-static-${CACHE_VERSION}`;

// Subject pack caching version. Bump to invalidate old offline packs.
const PACK_CACHE_VERSION = "v1";
const PACK_CACHE_PREFIX = "learnsphere-pack";

// For runtime image caching
const RUNTIME_IMAGE_CACHE_NAME = `learnsphere-images-${CACHE_VERSION}`;


const QUIZ_PRACTICE_URLS = [
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
  "/offlineSync.js",

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
];

// App shell URLs. Runtime caching covers the rest.
const APP_SHELL_URLS = [
  ...QUIZ_PRACTICE_URLS,

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
  "/badges.js",
  "/badges.css",
  "/exportProgress.js",
  "/dashboardProgress.js",

  "/manifest.json",

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

async function cacheUrlsIndividually(cache, urls) {
  const uniqueUrls = [...new Set(urls)];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response && response.ok) {
          await cache.put(url, response);
        } else {
          console.warn(`LearnSphere: Skipping cache for ${url} (${response?.status || "no response"})`);
        }
      } catch (err) {
        console.warn(`LearnSphere: Skipping cache for ${url}`, err);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cacheUrlsIndividually(cache, APP_SHELL_URLS);
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
      const keepCaches = new Set([CACHE_NAME, RUNTIME_IMAGE_CACHE_NAME]);

      // Keep current pack caches, drop all others
      for (const k of keys) {
        if (k.startsWith(`${PACK_CACHE_PREFIX}-${"physics"}-v`) ||
            k.startsWith(`${PACK_CACHE_PREFIX}-${"maths"}-v`) ||
            k.startsWith(`${PACK_CACHE_PREFIX}-${"chemistry"}-v`)) {
          // handled below by explicit keep list
        }
      }

      const subjects = ["physics", "maths", "chemistry"];
      for (const subject of subjects) {
        keepCaches.add(`${PACK_CACHE_PREFIX}-${subject}-v${PACK_CACHE_VERSION}`);
      }

      await Promise.all(
        keys.map((k) => {
          if (!keepCaches.has(k)) return caches.delete(k);
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

    // Navigation: network-first to avoid serving stale HTML/entrypoints
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
          // Prefer the specific cached HTML for quiz routes if present.
          if (req.url.includes("/quiz/") && req.url.includes(".html")) {
            const cachedQuizHtml = await cache.match(req, { ignoreVary: true });
            if (cachedQuizHtml) return cachedQuizHtml;
          }

          const cachedIndex =
            (await cache.match("/index.html")) || (await cache.match("/home.html"));
          const cached404 = await cache.match("/404.html");
          return cachedIndex || cached404 || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Same-origin static assets
  if (url && isSameOrigin(url)) {
    const pathname = url.pathname;

    // Images: runtime cache-first (images/ and img/)
    const isImagePath = pathname.startsWith("/images/") || pathname.startsWith("/img/");
    const isImageRequest = req.destination === "image" ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg") ||
      pathname.endsWith(".gif") ||
      pathname.endsWith(".svg") ||
      pathname.endsWith(".webp");

    if (isImagePath && isImageRequest) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(RUNTIME_IMAGE_CACHE_NAME);
          const cached = await cache.match(req, { ignoreVary: true });
          if (cached) return cached;

          try {
            const fresh = await fetch(req);
            if (fresh && fresh.status === 200) {
              cache.put(req, fresh.clone()).catch(() => {});
            }
            return fresh;
          } catch {
            return new Response("Offline Image Not Available", { status: 503 });
          }
        })()
      );
      return;
    }

    // Static assets: cache-first (JS/CSS/fonts/images handled here)
    const isAsset =
      req.destination === "script" ||
      req.destination === "style" ||
      req.destination === "font" ||
      req.destination === "worker" ||
      req.destination === "fetch";

    const fileLike =
      pathname.endsWith(".js") ||
      pathname.endsWith(".css") ||
      pathname.endsWith(".woff") ||
      pathname.endsWith(".woff2") ||
      pathname.endsWith(".ttf") ||
      pathname.endsWith(".eot") ||
      pathname.endsWith(".json");

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
  if (event.data && event.data.action === "download-offline-pack") {
    const subject = event.data.subject;
    if (!subject) return;

    const packSubject = String(subject);
    const validSubjects = new Set(["physics", "maths", "chemistry"]);
    if (!validSubjects.has(packSubject)) {
      event.source?.postMessage?.({
        action: "offline-pack-status",
        subject: packSubject,
        status: "failed",
        error: "Invalid subject",
      });
      return;
    }

    event.waitUntil(
      (async () => {
        const packCacheName = `${PACK_CACHE_PREFIX}-${packSubject}-v${PACK_CACHE_VERSION}`;
        const cache = await caches.open(packCacheName);

        // If already downloaded, treat as completed.
        const markerUrl = `/offline-pack/${packSubject}/v${PACK_CACHE_VERSION}/marker.txt`;
        const existingMarker = await cache.match(markerUrl);
        if (existingMarker) {
          const clientsList = await self.clients.matchAll();
          clientsList.forEach((client) => {
            client.postMessage({
              action: "offline-pack-status",
              subject: packSubject,
              status: "completed",
            });
          });
          return;
        }

        const subjectLessonUrls = (() => {
          if (packSubject === "physics") return ["/sub/physics.html"]; 
          if (packSubject === "maths") return ["/sub/maths.html"]; 
          if (packSubject === "chemistry") return ["/sub/chemistry.html"]; 
          return [];
        })();

        const subjectQuizUrls = (() => {
          if (packSubject === "physics")
            return [
              "/quiz/motionquiz.html",
              "/quiz/nlmquiz.html",
              "/quiz/projectilequiz.html",
              "/quiz/rayquiz.html",
            ];
          if (packSubject === "maths")
            return [
              "/mathsquiz/calculusquiz.html",
              "/mathsquiz/geometryquiz.html",
              "/mathsquiz/probabilityquiz.html",
              "/mathsquiz/vectorquiz.html",
            ];
          if (packSubject === "chemistry")
            return [
              "/chemistryquiz/atomic_structurequiz.html",
              "/chemistryquiz/chemical_bondingquiz.html",
              "/chemistryquiz/equilibriumquiz.html",
              "/chemistryquiz/thermoquiz.html",
            ];
          return [];
        })();

        // Heuristic: quiz page companion assets live in same folders and are cached by SW anyway.
        // But we also cache quiz JS/CSS in the pack for stronger offline reliability.
        const subjectQuizJsAndCssUrls = (() => {
          const urls = [];
          const pushIf = (u) => urls.push(u);
          if (packSubject === "physics") {
            pushIf("/quiz/motionquiz.js");
            pushIf("/quiz/nlmquiz.js");
            pushIf("/quiz/projectilequiz.js");
            pushIf("/quiz/rayquiz.js");
            pushIf("/quiz/motionquiz.css");
            pushIf("/quiz/nlmquiz.css");
            pushIf("/quiz/projectilequiz.css");
            pushIf("/quiz/rayquiz.css");
          }
          if (packSubject === "maths") {
            pushIf("/mathsquiz/calculusquiz.js");
            pushIf("/mathsquiz/geometryquiz.js");
            pushIf("/mathsquiz/probabilityquiz.js");
            pushIf("/mathsquiz/vectorquiz.js");
            pushIf("/mathsquiz/calculusquiz.css");
            pushIf("/mathsquiz/geometryquiz.css");
            pushIf("/mathsquiz/probabilityquiz.css");
            pushIf("/mathsquiz/vectorquiz.css");
          }
          if (packSubject === "chemistry") {
            pushIf("/chemistryquiz/atomic_structurequiz.js");
            pushIf("/chemistryquiz/chemical_bondingquiz.js");
            pushIf("/chemistryquiz/equilibriumquiz.js");
            pushIf("/chemistryquiz/thermoquiz.js");
            pushIf("/chemistryquiz/atomic_structurequiz.css");
            pushIf("/chemistryquiz/chemical_bondingquiz.css");
            pushIf("/chemistryquiz/equilibriumquiz.css");
            pushIf("/chemistryquiz/thermoquiz.css");
          }
          return urls;
        })();

        // Always include these shared JS dependencies that might be needed by quiz pages.
        const sharedQuizDependencies = [
          "/quizUtils.js",
          "/quizProgress.js",
          "/quiz/quizModel.js",
          "/quiz/adaptiveQuiz.js",
          "/quizUtils.test.js",
          "/quizAssignmentHelper.js",
        ].filter(Boolean);

        const urlsToCache = [
          ...subjectLessonUrls,
          ...subjectQuizUrls,
          ...subjectQuizJsAndCssUrls,
          ...sharedQuizDependencies,
        ];

        // De-dupe
        const uniqueUrls = [...new Set(urlsToCache)];
        const total = uniqueUrls.length;
        const clientsList = await self.clients.matchAll();

        const broadcast = (payload) => {
          clientsList.forEach((client) => client.postMessage(payload));
        };

        broadcast({
          action: "offline-pack-status",
          subject: packSubject,
          status: "downloading",
          downloaded: 0,
          total,
        });

        let downloaded = 0;
        try {
          await Promise.all(
            uniqueUrls.map(async (u) => {
              try {
                const resp = await fetch(u, { cache: "reload" });
                if (resp && resp.ok) {
                  await cache.put(u, resp.clone());
                }
              } catch (e) {
                // Ignore individual asset failures so the pack can still succeed.
                console.warn(`LearnSphere: Pack cache miss for ${u}`, e);
              } finally {
                downloaded++;
                if (downloaded === 1 || downloaded % 3 === 0 || downloaded === total) {
                  broadcast({
                    action: "offline-pack-status",
                    subject: packSubject,
                    status: "downloading",
                    downloaded,
                    total,
                  });
                }
              }
            })
          );

          // Write marker so we can detect completion next time.
          await cache.put(
            markerUrl,
            new Response(`ok:${packSubject}:${PACK_CACHE_VERSION}`, {
              headers: { "Content-Type": "text/plain" },
            })
          );

          broadcast({
            action: "offline-pack-status",
            subject: packSubject,
            status: "completed",
          });
        } catch (err) {
          broadcast({
            action: "offline-pack-status",
            subject: packSubject,
            status: "failed",
            error: err?.message || String(err),
          });
        }
      })()
    );
    return;
  }

  if (event.data && event.data.action === "preload") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        
        const urlsToPreload = [
          ...QUIZ_PRACTICE_URLS,
          "/sub/maths.html",
          "/sub/physics.html",
          "/sub/chemistry.html",
          "/sub/biology.html",
        ];

        try {
          await cacheUrlsIndividually(cache, urlsToPreload);
          
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


  // Handle manual sync flush request from clients
  if (event.data && event.data.action === "flush-offline-queue") {
    // Notify all clients to flush their offline queues
    event.waitUntil(
      self.clients.matchAll().then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ action: "do-flush-offline-queue" });
        });
      })
    );
  }

  // Handle online event forwarded from clients — register background sync
  if (event.data && event.data.action === "register-sync") {
    event.waitUntil(
      (async () => {
        // Notify all clients that a sync cycle is starting
        const clientsList = await self.clients.matchAll();
        clientsList.forEach((client) => {
          client.postMessage({ action: "sync-status", status: "syncing" });
        });

        // Register background sync if available
        if ("SyncManager" in self) {
          try {
            await self.registration.sync.register("learnsphere-sync-progress");
          } catch (err) {
            console.warn("LearnSphere: SW Background Sync registration failed:", err);
            // Fallback: tell clients to flush directly
            clientsList.forEach((client) => {
              client.postMessage({ action: "do-flush-offline-queue" });
            });
          }
        } else {
          // No SyncManager — tell clients to flush directly
          clientsList.forEach((client) => {
            client.postMessage({ action: "do-flush-offline-queue" });
          });
        }
      })()
    );
  }

  // Handle queue status check requests
  if (event.data && event.data.action === "check-queue-status") {
    event.waitUntil(
      self.clients.matchAll().then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ action: "request-queue-status" });
        });
      })
    );
  }
});

// Background Sync: flush offline queue when connectivity returns
self.addEventListener("sync", (event) => {
  if (event.tag === "learnsphere-sync-progress") {
    event.waitUntil(
      (async () => {
        const clientsList = await self.clients.matchAll();

        // Notify clients that sync is in progress
        clientsList.forEach((client) => {
          client.postMessage({ action: "sync-status", status: "syncing" });
        });

        // Tell clients to perform the actual flush
        clientsList.forEach((client) => {
          client.postMessage({ action: "do-flush-offline-queue" });
        });
      })()
    );
  }
});

