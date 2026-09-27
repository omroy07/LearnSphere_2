// authConfig.js — LearnSphere auth API base URL (Node.js, default port 5001).
// Vite dev (5173) uses same-origin + proxy; Docker uses docker/authConfig.js (AUTH_BASE_URL="").
(function () {
  if (window.AUTH_BASE_URL !== undefined && window.AUTH_BASE_URL !== null) {
    return;
  }
  const port = window.location.port;
  const isViteDev = port === "5173" || port === "4173";
  window.AUTH_BASE_URL = isViteDev ? "" : "http://127.0.0.1:5001";
})();
