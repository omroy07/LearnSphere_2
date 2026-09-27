/**
 * Register the PWA service worker in production only.
 * On Vite dev (5173 / 4173), unregister any existing SW so stale CSS/JS caches
 * do not break local development.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const port = window.location.port;
  const isViteDev =
    (host === "localhost" || host === "127.0.0.1") &&
    (port === "5173" || port === "4173");

  if (isViteDev) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) {
        reg.unregister().catch(function () {});
      });
    });
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) {
          if (key.startsWith("learnsphere-")) {
            caches.delete(key).catch(function () {});
          }
        });
      });
    }
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function (err) {
      console.warn("LearnSphere: Service Worker registration failed:", err);
    });
  });
})();
