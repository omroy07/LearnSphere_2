/**
 * offlineSync.js — LearnSphere Offline Sync Manager
 *
 * Queues quiz progress updates when offline and flushes them on reconnect.
 * Currently the app is localStorage-only; the queue is structured so a future
 * backend can POST each entry to /api/sync-progress without changes.
 *
 * Usage: Include this script BEFORE quizProgress.js on quiz pages.
 *
 * Public API (via window.offlineSync):
 *   queueProgressUpdate(type, payload)  — add an item to the offline queue
 *   flushQueue()                        — replay queued items and clear
 *   getQueueLength()                    — pending items count
 *   isOnline()                          — navigator.onLine wrapper
 */

(function () {
  "use strict";

  const QUEUE_KEY = "learnsphere_offline_queue_v1";
  const DEDUP_WINDOW_MS = 2000; // ignore duplicate entries within 2 s

  // ── Queue Persistence ─────────────────────────────────────────────────────

  function _loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function _saveQueue(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn("LearnSphere: Could not persist offline queue.", e);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Queue a progress update for future sync.
   * @param {"quiz_attempt"|"retry_attempt"} type
   * @param {Object} payload — arguments originally passed to recordAttempt / recordRetryAttempt
   */
  function queueProgressUpdate(type, payload) {
    const queue = _loadQueue();
    const now = Date.now();

    // Basic dedup: skip if an identical-looking entry was queued very recently
    const isDuplicate = queue.some(
      (item) =>
        item.type === type &&
        item.payload &&
        item.payload.topicId === payload.topicId &&
        item.payload.quizId === payload.quizId &&
        Math.abs(now - item.queuedAt) < DEDUP_WINDOW_MS
    );
    if (isDuplicate) return;

    queue.push({
      id: _uid(),
      type,
      payload,
      queuedAt: now,
      synced: false,
    });

    // Keep queue bounded (max 200 entries)
    if (queue.length > 200) {
      queue.splice(0, queue.length - 200);
    }

    _saveQueue(queue);
    _dispatchQueueChange(queue.length);
  }

  /**
   * Flush all queued progress updates.
   * Since the app currently uses localStorage only, flushing means marking
   * entries as synced (the data is already saved locally by quizProgress.js).
   * When a backend is added, each entry can be POSTed here before marking synced.
   */
  // Endpoint can be overridden by window.__learnsphereSyncEndpoint
  function _syncEndpoint() {
    if (window && window.__learnsphereSyncEndpoint) return window.__learnsphereSyncEndpoint;
    // Default (can be changed later)
    return "/api/sync-progress";
  }

  async function _postSyncItem(item) {
    const endpoint = _syncEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        type: item.type,
        payload: item.payload,
        queuedAt: item.queuedAt,
        id: item.id,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Sync failed: ${res.status} ${res.statusText}${text ? ": " + text : ""}`);
    }
  }

  async function flushQueue() {
    const queue = _loadQueue();
    if (queue.length === 0) return;

    // Do not attempt sync if offline
    if (!isOnline()) {
      _dispatchQueueChange(queue.filter((i) => !i.synced).length);
      return;
    }

    // Simple sequential sync to keep it reliable
    let flushedCount = 0;

    for (const item of queue) {
      if (item.synced) continue;

      try {
        // Retry with same item; backend should be idempotent using item.id
        await _postSyncItem(item);
        item.synced = true;
        flushedCount++;
      } catch (e) {
        // Leave unsynced so it retries next time
        console.warn("LearnSphere: Failed to sync queued item:", item.id, e);
        // Stop early on first failure to reduce load
        break;
      }
    }

    const remaining = queue.filter((item) => !item.synced);
    _saveQueue(remaining);

    if (flushedCount > 0) {
      console.info(`LearnSphere: Synced ${flushedCount} queued progress update(s).`);
      _dispatchSyncComplete(flushedCount);
    }

    _dispatchQueueChange(remaining.length);
  }

  /** @returns {number} Number of pending (unsynced) items */
  function getQueueLength() {
    const queue = _loadQueue();
    return queue.filter((item) => !item.synced).length;
  }

  /** @returns {boolean} Current network status */
  function isOnline() {
    return navigator.onLine !== false;
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _dispatchQueueChange(pendingCount) {
    try {
      window.dispatchEvent(
        new CustomEvent("learnsphere:queue-change", {
          detail: { pendingCount },
        })
      );
    } catch {
      // Ignore if CustomEvent is unsupported
    }
  }

  function _dispatchSyncComplete(syncedCount) {
    try {
      window.dispatchEvent(
        new CustomEvent("learnsphere:sync-complete", {
          detail: { syncedCount },
        })
      );
    } catch {
      // Ignore
    }
  }

  // ── Auto-sync on Reconnect ────────────────────────────────────────────────

  function _onOnline() {
    console.info("LearnSphere: Back online — flushing offline queue.");
    flushQueue();

    // Request Background Sync if available (for reliability)
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.sync.register("learnsphere-sync-progress"))
        .catch(() => {
          // Background Sync not available; manual flush above covers it
        });
    }
  }

  window.addEventListener("online", _onOnline);

  // Also flush on page load if online and there are queued items
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

  // ── Offline Status Bar UI Helper ──────────────────────────────────────────

  /**
   * Injects an offline/online status bar into the quiz page.
   * Call once on DOMContentLoaded. The bar auto-updates on connectivity changes.
   */
  function initOfflineStatusBar() {
    const container = document.querySelector(".container");
    if (!container) return;

    // Create status bar element
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

    // Insert as first child of .container
    container.insertBefore(bar, container.firstChild);

    // Inject animation styles
    if (!document.getElementById("offline-status-styles")) {
      const style = document.createElement("style");
      style.id = "offline-status-styles";
      style.textContent = `
        @keyframes offlineSlideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes offlinePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
        @keyframes syncPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        }
        #offline-status-bar.offline-active {
          display: flex !important;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08));
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          animation: offlineSlideDown 0.3s ease-out, offlinePulse 2s ease-in-out 3;
        }
        #offline-status-bar.sync-success {
          display: flex !important;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08));
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
          animation: offlineSlideDown 0.3s ease-out, syncPulse 1.5s ease-in-out 2;
        }
        #offline-status-bar .queue-badge {
          background: rgba(255, 255, 255, 0.15);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.78rem;
          margin-left: auto;
        }
        #offline-status-bar .dismiss-btn {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 1.1rem;
          padding: 0 4px;
          margin-left: 8px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        #offline-status-bar .dismiss-btn:hover {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }

    let syncDismissTimer = null;

    function updateBar() {
      const online = isOnline();
      const pending = getQueueLength();

      if (!online) {
        // Offline state
        bar.className = "offline-active";
        bar.innerHTML = `
          <span>📴 You're offline — your quiz works normally. Progress is saved locally.</span>
          ${pending > 0 ? `<span class="queue-badge">${pending} pending</span>` : ""}
        `;
        if (syncDismissTimer) {
          clearTimeout(syncDismissTimer);
          syncDismissTimer = null;
        }
      } else if (bar.classList.contains("offline-active")) {
        // Just came back online
        bar.className = "sync-success";
        bar.innerHTML = `
          <span>✅ Back online — progress synced!</span>
          <button class="dismiss-btn" aria-label="Dismiss" title="Dismiss">✕</button>
        `;
        bar.querySelector(".dismiss-btn").addEventListener("click", () => {
          bar.className = "";
          bar.style.display = "none";
        });
        // Auto-dismiss after 5 seconds
        syncDismissTimer = setTimeout(() => {
          bar.className = "";
          bar.style.display = "none";
        }, 5000);
      }
    }

    // Wire up events
    window.addEventListener("online", updateBar);
    window.addEventListener("offline", updateBar);
    window.addEventListener("learnsphere:sync-complete", () => {
      if (isOnline()) {
        bar.className = "sync-success";
        bar.innerHTML = `
          <span>✅ Back online — progress synced!</span>
          <button class="dismiss-btn" aria-label="Dismiss" title="Dismiss">✕</button>
        `;
        bar.querySelector(".dismiss-btn").addEventListener("click", () => {
          bar.className = "";
          bar.style.display = "none";
        });
        if (syncDismissTimer) clearTimeout(syncDismissTimer);
        syncDismissTimer = setTimeout(() => {
          bar.className = "";
          bar.style.display = "none";
        }, 5000);
      }
    });
    window.addEventListener("learnsphere:queue-change", (e) => {
      if (!isOnline()) updateBar();
    });

    // Initial check
    updateBar();
  }

  // Auto-init the status bar when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOfflineStatusBar);
  } else {
    initOfflineStatusBar();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  window.offlineSync = {
    queueProgressUpdate,
    flushQueue,
    getQueueLength,
    isOnline,
    initOfflineStatusBar,
  };
})();
