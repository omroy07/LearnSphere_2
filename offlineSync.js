// offlineSync.js — Robust Offline Sync with Conflict Resolution
// This module implements an append‑only event log, configurable conflict handling,
// exponential back‑off retries, and idempotent sync requests.

(function () {
  "use strict";

  const quizUtils = (typeof window !== 'undefined' && window.quizUtils) || 
                    (typeof require !== 'undefined' && require('./quizUtils.js')) || 
                    (typeof globalThis !== 'undefined' && globalThis.quizUtils) ||
                    {
                      resolveSyncConflicts(events = [], strategy = "latest") {
                        if (!events.length) return [];
                        if (strategy === "latest") {
                          const map = new Map();
                          events.forEach((e) => {
                            const key = `${e.type}|${e.payload?.topicId || ""}|${e.payload?.quizId || ""}`;
                            const existing = map.get(key);
                            if (!existing || e.timestamp > existing.timestamp) {
                              map.set(key, e);
                            }
                          });
                          return Array.from(map.values());
                        }
                        return events;
                      }
                    };

  // ----- Configuration -------------------------------------------------------
  const DEFAULT_CONFIG = {
    maxRetries: 5,
    baseBackoffMs: 1000, // 1 second
    conflictStrategy: "latest", // "latest" | "maxScore" | "perAttempt"
  };
  // Users can override via window.offlineSyncConfig before this script loads.
  const config = Object.assign({}, DEFAULT_CONFIG, window.offlineSyncConfig || {});

  // ----- Persistence ----------------------------------------------------------
  const LOG_KEY = "learnsphere_offline_log_v1";

  function _loadLog() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function _saveLog(log) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) {
      console.warn("LearnSphere: Could not persist offline log.", e);
    }
  }

  // ----- Helpers -------------------------------------------------------------
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _backoffDelay(retryCount) {
    return config.baseBackoffMs * Math.pow(2, retryCount - 1);
  }

  // ----- Conflict Resolution -------------------------------------------------
  function _resolveConflicts(events) {
    return quizUtils.resolveSyncConflicts(events, config.conflictStrategy);
  }

  // ----- Public API ----------------------------------------------------------
  function queueProgressUpdate(type, payload) {
    const log = _loadLog();
    const now = Date.now();
    const event = {
      id: _uid(),
      type,
      payload,
      timestamp: now,
      synced: false,
      retryCount: 0,
      nextRetryAt: null,
    };
    log.push(event);
    // Keep log bounded (max 200 entries)
    if (log.length > 200) {
      log.splice(0, log.length - 200);
    }
    _saveLog(log);
    _dispatchQueueChange(_pendingCount(log));
  }

  function _pendingCount(log) {
    const now = Date.now();
    return log.filter((e) => !e.synced && (!e.nextRetryAt || e.nextRetryAt <= now)).length;
  }

  function getQueueLength() {
    const log = _loadLog();
    return _pendingCount(log);
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  // ----- Sync Endpoint -------------------------------------------------------
  function _syncEndpoint() {
    if (window && window.__learnsphereSyncEndpoint) return window.__learnsphereSyncEndpoint;
    return "/api/sync-progress";
  }

  async function _postSyncItem(event) {
    const endpoint = _syncEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        id: event.id,
        type: event.type,
        payload: event.payload,
        timestamp: event.timestamp,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Sync failed: ${res.status} ${res.statusText}${text ? ": " + text : ""}`);
    }
  }

  async function flushQueue() {
    const log = _loadLog();
    if (!log.length) return;
    if (!isOnline()) {
      _dispatchQueueChange(_pendingCount(log));
      return;
    }
    // Filter events ready for sync
    const now = Date.now();
    const ready = log.filter((e) => !e.synced && (!e.nextRetryAt || e.nextRetryAt <= now));
    if (!ready.length) return;

    // Resolve conflicts according to strategy (produces a subset to send)
    const toSync = _resolveConflicts(ready);
    let flushed = 0;
    for (const event of toSync) {
      try {
        await _postSyncItem(event);
        event.synced = true;
        flushed++;
      } catch (e) {
        console.warn("LearnSphere: Failed to sync event", event.id, e);
        // Apply exponential back‑off
        event.retryCount = Math.min(event.retryCount + 1, config.maxRetries);
        if (event.retryCount >= config.maxRetries) {
          // Give up on this event, keep it unsynced for manual inspection
          console.error(`LearnSphere: Max retries reached for event ${event.id}`);
        } else {
          event.nextRetryAt = now + _backoffDelay(event.retryCount);
        }
        // Stop processing further to avoid hammering the server
        break;
      }
    }
    // Remove fully synced events from log
    const remaining = log.filter((e) => !e.synced);
    _saveLog(remaining);
    if (flushed > 0) {
      console.info(`LearnSphere: Synced ${flushed} queued progress update(s).`);
      _dispatchSyncComplete(flushed);
    }
    _dispatchQueueChange(_pendingCount(remaining));
  }

  // ----- Event Dispatch ------------------------------------------------------
  function _dispatchQueueChange(pendingCount) {
    try {
      window.dispatchEvent(new CustomEvent("learnsphere:queue-change", { detail: { pendingCount } }));
    } catch {}
  }

  function _dispatchSyncComplete(syncedCount) {
    try {
      window.dispatchEvent(new CustomEvent("learnsphere:sync-complete", { detail: { syncedCount } }));
    } catch {}
  }

  // ----- UI: Offline Status Bar ---------------------------------------------
  function initOfflineStatusBar() {
    const container = document.querySelector(".container");
    if (!container) return;
    const bar = document.createElement("div");
    bar.id = "offline-status-bar";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.style.cssText = [
      "display: none",
      "padding: 10px 16px",
      "border-radius: 10px",
      "margin-bottom: 16px",
      "font-size: 0.88rem",
      "font-weight: 600",
      "font-family: 'Poppins', 'Inter', sans-serif",
      "transition: all 0.3s ease",
      "position: relative",
      "overflow: hidden",
    ].join(";");
    container.insertBefore(bar, container.firstChild);

    if (!document.getElementById("offline-status-styles")) {
      const style = document.createElement("style");
      style.id = "offline-status-styles";
      style.textContent = `
        @keyframes offlineSlideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes offlinePulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.3);} 50% { box-shadow:0 0 0 6px rgba(239,68,68,0);} }
        @keyframes syncPulse { 0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,0.3);} 50% { box-shadow:0 0 0 6px rgba(34,197,94,0);} }
        #offline-status-bar.offline-active { display:flex!important; align-items:center; gap:10px; background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.08)); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; animation:offlineSlideDown 0.3s ease-out, offlinePulse 2s ease-in-out 3; }
        #offline-status-bar.sync-success { display:flex!important; align-items:center; gap:10px; background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.08)); border:1px solid rgba(34,197,94,0.3); color:#86efac; animation:offlineSlideDown 0.3s ease-out, syncPulse 1.5s ease-in-out 2; }
        #offline-status-bar .queue-badge { background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:12px; font-size:0.78rem; margin-left:auto; }
        #offline-status-bar .dismiss-btn { background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem; padding:0 4px; margin-left:8px; opacity:0.7; transition:opacity 0.2s; }
        #offline-status-bar .dismiss-btn:hover { opacity:1; }
      `;
      document.head.appendChild(style);
    }

    let dismissTimer = null;
    function updateBar() {
      const online = isOnline();
      const pending = getQueueLength();
      if (!online) {
        bar.className = "offline-active";
        bar.innerHTML = `
          <span>📴 You're offline — your quiz works normally. Progress is saved locally.</span>
          ${pending > 0 ? `<span class="queue-badge">${pending} pending</span>` : ``}
        `;
        if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
      } else if (bar.classList.contains("offline-active")) {
        bar.className = "sync-success";
        bar.innerHTML = `
          <span>✅ Back online — progress synced!</span>
          <button class="dismiss-btn" aria-label="Dismiss" title="Dismiss">✕</button>
        `;
        bar.querySelector('.dismiss-btn').addEventListener('click', () => { bar.className = ""; bar.style.display = "none"; });
        dismissTimer = setTimeout(() => { bar.className = ""; bar.style.display = "none"; }, 5000);
      }
    }
    window.addEventListener("online", updateBar);
    window.addEventListener("offline", updateBar);
    window.addEventListener("learnsphere:sync-complete", () => { if (isOnline()) updateBar(); });
    window.addEventListener("learnsphere:queue-change", (e) => { if (!isOnline()) updateBar(); });
    updateBar();
  }

  // ----- Auto‑sync on reconnect ------------------------------------------------
  function _onOnline() {
    console.info("LearnSphere: Back online — flushing offline log.");
    flushQueue();
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.sync.register("learnsphere-sync-progress"))
        .catch(() => {});
    }
  }

  window.addEventListener("online", _onOnline);

  // Initial flush on page load if applicable
  function _initFlush() {
    if (isOnline() && getQueueLength() > 0) {
      flushQueue();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initFlush);
  } else {
    _initFlush();
  }

  // Auto‑init status bar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOfflineStatusBar);
  } else {
    initOfflineStatusBar();
  }

  // Export API
  window.offlineSync = {
    queueProgressUpdate,
    flushQueue,
    getQueueLength,
    isOnline,
    initOfflineStatusBar,
  };
})();
